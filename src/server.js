console.log('📝 [DEBUG] Loading config...');
let config, app, connectDB;

try {
  config = require('./config/config');
  console.log('📝 [DEBUG] Config loaded successfully');
  console.log('📝 [DEBUG] Port:', config.port);
  console.log('📝 [DEBUG] Environment:', config.env);
  console.log('📝 [DEBUG] MongoDB URI:', config.db.uri ? 'Set' : 'Not set');
} catch (error) {
  console.error('❌ [ERROR] Failed to load config:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

console.log('📝 [DEBUG] Loading app...');
try {
  app = require('./app');
  console.log('📝 [DEBUG] App loaded successfully');
} catch (error) {
  console.error('❌ [ERROR] Failed to load app:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

console.log('📝 [DEBUG] Loading database utils...');
try {
  ({ connectDB } = require('./utils/db'));
  console.log('📝 [DEBUG] Database utils loaded successfully');
} catch (error) {
  console.error('❌ [ERROR] Failed to load database utils:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

console.log('📝 [DEBUG] Loading realtime service...');
try {
  const realtimeService = require('./services/realtime.service');
  console.log('📝 [DEBUG] Realtime service loaded successfully');
} catch (error) {
  console.error('❌ [ERROR] Failed to load realtime service:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

console.log('🔧 Démarrage du serveur...');
console.log(`⚙️  Environnement: ${config.env}`);
console.log(`🔗 Port: ${config.port}`);
console.log(`🌐 URL de l'API: http://localhost:${config.port}${config.api.prefix}`);

// Démarrer le serveur
const startServer = async () => {
  let dbConnection = null;
  
  try {
    console.log('📝 [DEBUG] Starting server function...');
    console.log('🔄 Connexion à la base de données...');
    
    // Tenter de se connecter à la base de données
    console.log('📝 [DEBUG] About to call connectDB...');
    dbConnection = await connectDB();
    
    if (dbConnection) {
      console.log('📝 [DEBUG] connectDB completed successfully');
      console.log('✅ Base de données connectée - toutes les fonctionnalités disponibles');
    } else {
      console.log('⚠️  Serveur démarré sans connexion à la base de données');
      console.log('   Certaines fonctionnalités seront limitées');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la connexion à la base de données:', error.message);
    console.log('⚠️  Le serveur va démarrer sans base de données');
    console.log('   Certaines fonctionnalités seront indisponibles');
  }
  
  try {
    console.log('🚀 Démarrage du serveur HTTP...');
    console.log('📝 [DEBUG] App object:', typeof app);
    console.log('📝 [DEBUG] Config port:', config.port);
    
    // Démarrer le serveur même sans connexion DB
    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`✅ Serveur démarré avec succès sur le port ${config.port}`);
      console.log(`🌍 Environnement: ${config.env}`);
      console.log(`📡 API disponible à http://localhost:${config.port}${config.api.prefix}`);
      console.log(`📚 Documentation Swagger: http://localhost:${config.port}${config.api.prefix}/api-docs`);
      
      // Initialiser le service de notifications temps réel
      try {
        const realtimeService = require('./services/realtime.service');
        realtimeService.initialize(server);
        console.log(`🔴 WebSocket disponible à ws://localhost:${config.port}/ws`);
      } catch (error) {
        console.error('❌ Erreur initialisation WebSocket:', error.message);
      }
      
      if (!dbConnection) {
        console.log('⚠️  ATTENTION: Base de données non connectée!');
        console.log('   Configurez MONGODB_URI pour activer toutes les fonctionnalités');
      }
    });

    console.log('📝 [DEBUG] Server listen called, waiting for callback...');

    // Gestion des erreurs du serveur
    server.on('error', (error) => {
      console.error('❌ [SERVER ERROR]:', error.message);
      if (error.code === 'EADDRINUSE') {
        console.error(`Le port ${config.port} est déjà utilisé`);
      }
      process.exit(1);
    });

    // Gestion des erreurs non capturées
    process.on('unhandledRejection', (err) => {
      console.error('❌ [UNHANDLED REJECTION]:', err);
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });
    
    return server;
  } catch (error) {
    console.error('❌ Échec du démarrage du serveur:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  console.error('Exception non gérée:', err);
  process.exit(1);
});

// Démarrer le serveur
startServer();

// Gestion de la sortie du processus
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM reçu. Arrêt en cours...');
  if (server) {
    server.close(() => {
      console.log('Processus terminé');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
