require('dotenv').config();

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5002,
  frontendUrl: process.env.FRONTEND_URL || 'https://geopressci.com/', 'https://geopressci.netlify.app/',
  
  // CORS Configuration
  cors: {
    allowedOrigins: [
      process.env.FRONTEND_URL || 'https://geopressci.com', 'https://geopressci.netlify.app/',
      'http://127.0.0.1:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRE || '30d',
    resetPasswordExpiresIn: '1h', // Durée de validité du token de réinitialisation
  },

  // Database Configuration
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/geopressci',
    options: {
      // Les options useNewUrlParser et useUnifiedTopology sont désormais les valeurs par défaut dans Mongoose 6+
      // et seront supprimées dans les futures versions
      // Aucune option nécessaire pour MongoDB Driver 4.0+
    },
  },

  // Mapbox API (remplace Google Maps)
  mapbox: {
    accessToken: process.env.MAPBOX_ACCESS_TOKEN,
  },

  // Google Maps API (deprecated - utiliser Mapbox)
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    from: `"${process.env.EMAIL_FROM_NAME || 'GeoPressCI'}" <${process.env.EMAIL_FROM_ADDRESS || 'no-reply@geopressci.ci'}>`,
    user: process.env.EMAIL_USERNAME,
    password: process.env.EMAIL_PASSWORD,
  },

  // SMS Configuration (exemple avec Twilio)
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // API Configuration
  api: {
    prefix: '/api/v1',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limite chaque IP à 100 requêtes par fenêtre
    },
  },

  // Configuration des notifications
  notifications: {
    // Activer/désactiver les notifications
    enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
    // Types de notifications par défaut (email, sms, both)
    defaultType: process.env.NOTIFICATIONS_DEFAULT_TYPE || 'email',
  },
};

module.exports = config;
