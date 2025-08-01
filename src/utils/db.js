const mongoose = require('mongoose');
const config = require('../config/config');

// Configuration des options de connexion
const options = {
  ...config.db.options,
  serverSelectionTimeoutMS: 10000, // Timeout après 10 secondes
  socketTimeoutMS: 45000, // Fermer les sockets après 45s d'inactivité
  maxPoolSize: 10, // Maintenir jusqu'à 10 connexions socket
  minPoolSize: 1, // Maintenir au moins 1 connexion socket
  maxIdleTimeMS: 30000, // Fermer les connexions après 30 secondes d'inactivité
  // bufferMaxEntries est obsolète et non supporté dans les nouvelles versions
};

// Désactiver le mode strict des requêtes
mongoose.set('strictQuery', false);

// Gestion des événements de connexion
mongoose.connection.on('connected', () => {
  console.log('✅ Connexion à MongoDB établie avec succès');
  console.log(`📊 Base de données: ${mongoose.connection.name}`);
  console.log(`🌐 Hôte: ${mongoose.connection.host}:${mongoose.connection.port}`);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur de connexion à MongoDB:');
  console.error('- Message:', err.message);
  console.error('- Code:', err.code);
  console.error('- CodeName:', err.codeName);
  console.error('- Stack:', err.stack);
});

mongoose.connection.on('disconnected', () => {
  console.log('❌ Déconnecté de MongoDB');});

// Gestion de la fermeture de la connexion
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('Connexion à MongoDB fermée suite à l\'arrêt de l\'application');
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de la fermeture de la connexion MongoDB:', error);
    process.exit(1);
  }
});

// Fonction de connexion à la base de données avec réessai
const connectDB = async (retries = 3, delay = 5000) => {
  console.log('🔄 Tentative de connexion à MongoDB...');
  
  // Vérifier si l'URI MongoDB est définie
  if (!config.db.uri) {
    console.error('❌ MONGODB_URI n\'est pas définie dans les variables d\'environnement');
    console.error('Veuillez définir MONGODB_URI avec votre chaîne de connexion MongoDB Atlas');
    process.exit(1);
  }
  
  // Masquer les identifiants dans les logs
  const maskedUri = config.db.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`🔗 URI: ${maskedUri}`);
  console.log(`🌍 Environnement: ${config.env}`);
  
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(config.db.uri, options);
      console.log('✅ Connexion à MongoDB réussie!');
      return mongoose.connection;
    } catch (error) {
      console.error(`❌ Tentative ${i + 1} échouée:`, error.message);
      
      // Log détaillé de l'erreur pour le débogage
      if (error.code) {
        console.error('- Code:', error.code);
      }
      if (error.stack && config.env === 'development') {
        console.error('- Stack:', error.stack);
      }
      
      if (i < retries - 1) {
        console.log(`⏳ Nouvelle tentative dans ${delay/1000} secondes...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`❌ Échec de la connexion après ${retries} tentatives`);
        console.error('\n🔍 Vérifications à effectuer:');
        
        if (config.db.uri.includes('127.0.0.1') || config.db.uri.includes('localhost')) {
          console.error('⚠️  Vous utilisez une base de données locale!');
          console.error('   Pour le déploiement, utilisez MongoDB Atlas:');
          console.error('   1. Créez un cluster sur https://cloud.mongodb.com');
          console.error('   2. Obtenez votre chaîne de connexion');
          console.error('   3. Définissez MONGODB_URI dans vos variables d\'environnement');
        } else {
          console.error('- Le cluster MongoDB Atlas est-il actif?');
          console.error('- L\'URI de connexion est-elle correcte?');
          console.error('- Vos identifiants sont-ils valides?');
          console.error('- Votre IP est-elle autorisée dans MongoDB Atlas?');
          console.error('- Le réseau permet-il les connexions sortantes sur le port 27017?');
        }
        
        // En production, ne pas arrêter le processus immédiatement
        if (config.env === 'production') {
          console.error('⚠️  En production: le serveur continuera sans base de données');
          console.error('   Les fonctionnalités nécessitant la DB seront indisponibles');
          return null;
        } else {
          process.exit(1);
        }
      }
    }
  }
};

module.exports = {
  connectDB,
  mongoose,
};
