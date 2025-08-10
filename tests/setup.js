/**
 * Configuration globale pour les tests d'intégration GeoPressCI
 */

const mongoose = require('mongoose');

// Configuration des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_integration_tests_very_long_and_secure_key';
process.env.MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/geopressci_test';

// Augmenter les timeouts pour les tests d'intégration
jest.setTimeout(30000);

// Configuration globale avant tous les tests
beforeAll(async () => {
  // Supprimer tous les listeners existants pour éviter les warnings
  process.removeAllListeners('warning');
  
  // Désactiver les logs pendant les tests
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

// Nettoyage après tous les tests
afterAll(async () => {
  // Fermer toutes les connexions MongoDB
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  
  // Fermer toutes les connexions ouvertes
  await new Promise(resolve => setTimeout(resolve, 500));
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  // Ignorer pendant les tests
});

process.on('uncaughtException', (error) => {
  // Ignorer pendant les tests
});

module.exports = {};
