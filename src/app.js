const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const config = require('./config/config');
const logger = require('./utils/logger');
const swaggerSpec = require('./config/swagger');

// Import des routes
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const pressingRoutes = require('./routes/pressing.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const billingRoutes = require('./routes/billing.routes');
const adminRoutes = require('./routes/admin.routes');
const mapsRoutes = require('./routes/maps');
const orderRoutes = require('./routes/order.routes');
const paymentRoutes = require('./routes/payment.routes');

// Initialisation de l'application Express
const app = express();

// Configuration CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = config.cors.allowedOrigins;
    
    console.log(`🔍 CORS Check - Origin: ${origin || 'no origin'}`);
    console.log(`🔍 Environment: ${config.env}`);
    
    // En développement, être plus permissif
    if (config.env === 'development') {
      // Accepter localhost sur tous les ports et les origines configurées
      if (!origin || 
          origin.startsWith('http://localhost:') || 
          origin.startsWith('http://127.0.0.1:') ||
          allowedOrigins.includes(origin)) {
        console.log(`✅ CORS: Accepting request from origin: ${origin || 'no origin'}`);
        return callback(null, true);
      }
    } else {
      // En production, vérifier les origines autorisées
      if (!origin || allowedOrigins.includes(origin)) {
        console.log(`✅ CORS: Accepting request from origin: ${origin || 'no origin'}`);
        return callback(null, true);
      }
    }
    
    const msg = `L'origine ${origin} n'est pas autorisée par CORS`;
    console.warn('⚠️ CORS: ' + msg);
    console.warn('⚠️ CORS: Origines autorisées:', allowedOrigins);
    return callback(new Error(msg), false);
  },
  credentials: config.cors.credentials,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Log des requêtes
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers
  });
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenue sur l\'API GeoPressCI',
    documentation: `${config.api.prefix}/api-docs`,
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Route de test publique
app.get('/api/v1/status', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: config.env,
    timestamp: new Date().toISOString(),
    database: 'connected',
    version: '1.0.0'
  });
});

// Documentation Swagger
app.use(
  `${config.api.prefix}/api-docs`,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'GeoPressCI API Documentation',
  })
);

// API Routes
app.use(`${config.api.prefix}`, healthRoutes);
app.use(`${config.api.prefix}/auth`, authRoutes);
app.use(`${config.api.prefix}/users`, userRoutes);
app.use(`${config.api.prefix}/pressings`, pressingRoutes);
// Route spéciale pour les statistiques pressing (compatibilité frontend)
app.use(`${config.api.prefix}/pressing`, pressingRoutes);
app.use(`${config.api.prefix}/subscriptions`, subscriptionRoutes);
app.use(`${config.api.prefix}/billing`, billingRoutes);
app.use(`${config.api.prefix}/orders`, orderRoutes);
app.use(`${config.api.prefix}/payments`, paymentRoutes);
app.use(`${config.api.prefix}/admin`, adminRoutes);
app.use(`${config.api.prefix}/maps`, mapsRoutes);

// Middleware pour journalisation des requêtes
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Gestion des erreurs 404
app.use((req, res, next) => {
  console.warn(`⚠️ Route non trouvée: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Ressource non trouvée',
    error: {
      statusCode: 404,
      message: `La route ${req.method} ${req.originalUrl} n'existe pas.`
    },
    timestamp: new Date().toISOString()
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  // Journalisation détaillée de l'erreur
  const errorDetails = {
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      code: err.code,
      details: err.details
    },
    request: {
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body
    }
  };

  // Journalisation dans la console en mode développement
  if (process.env.NODE_ENV !== 'test') {
    console.error('\n❌ ERREUR NON GÉRÉE ==============');
    console.error('Timestamp:', errorDetails.timestamp);
    console.error('Path:', errorDetails.path);
    console.error('Error:', errorDetails.error);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack:', errorDetails.error.stack);
    }
    console.error('==============================\n');
  }

  // Journalisation dans les fichiers de log
  logger.error('Erreur non gérée:', errorDetails);
  
  // Déterminer le code d'état HTTP approprié
  const statusCode = err.statusCode || 500;
  
  // Réponse d'erreur structurée
  const errorResponse = {
    success: false,
    message: err.message || 'Une erreur inattendue est survenue',
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      status: statusCode,
      timestamp: errorDetails.timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err.details
      })
    },
    ...(process.env.NODE_ENV === 'development' && {
      _debug: {
        path: req.path,
        method: req.method
      }
    })
  };

  // Envoyer la réponse d'erreur
  res.status(statusCode).json(errorResponse);
});

module.exports = app;
