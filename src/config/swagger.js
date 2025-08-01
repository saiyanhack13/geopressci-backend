const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./config');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GeoPressCI API',
      version: '1.0.0',
      description: 'API pour l\'application GeoPressCI - Mise en relation entre pressings et clients en Côte d\'Ivoire',
      contact: {
        name: 'Support API',
        email: 'support@geopressci.ci',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api/v1`,
        description: 'Serveur de développement',
      },
      {
        url: 'https://api.geopressci.ci/api/v1',
        description: 'Serveur de production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Token manquant ou invalide',
        },
        BadRequest: {
          description: 'Données de requête invalides',
        },
        NotFound: {
          description: 'Ressource non trouvée',
        },
        ServerError: {
          description: 'Erreur serveur',
        },
      },
      schemas: {
        // Schémas communs
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Message d\'erreur',
            },
          },
        },
        // Ajouter d'autres schémas communs ici
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Chemins vers les fichiers contenant la documentation
  apis: [
    './src/routes/*.js',
    './src/controllers/*.controller.js',
    './src/models/*.model.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
