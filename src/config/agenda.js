const logger = require('../utils/logger');

// Mock Agenda pour l'environnement de test
// Ceci évite de lancer une vraie instance de Agenda/MongoDB pendant les tests

const agendaMock = {
  define: (name, callback) => {
    logger.info(`[Test Mock] Agenda job '${name}' defined.`);
  },
  every: (interval, name, options) => {
    logger.info(`[Test Mock] Agenda job '${name}' scheduled to run every '${interval}'.`);
  },
  schedule: (when, name, data) => {
    logger.info(`[Test Mock] Agenda job '${name}' scheduled for '${when}'.`);
  },
  start: () => {
    logger.info('[Test Mock] Agenda started.');
  },
  on: (event, callback) => {
    logger.info(`[Test Mock] Agenda event listener for '${event}' registered.`);
    if (event === 'ready') {
      // Simuler l'événement 'ready' pour que le code qui en dépend ne bloque pas
      setTimeout(callback, 10);
    }
  }
};

module.exports = agendaMock;
