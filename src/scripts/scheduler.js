const cron = require('node-cron');
const subscriptionTasks = require('./subscriptionTasks');
const logger = require('../utils/logger');

// Connexion à la base de données
subscriptionTasks.connectDB().then(() => {
  logger.info('Connexion à la base de données établie pour le planificateur de tâches');
  
  // Planifier l'exécution quotidienne des tâches à minuit (00:00)
  cron.schedule('0 0 * * *', async () => {
    logger.info('Démarrage des tâches planifiées quotidiennes');
    
    try {
      // 1. Traiter les renouvellements d'abonnement
      await subscriptionTasks.processSubscriptionRenewals();
      
      // 2. Notifier les pressings dont la période d'essai se termine bientôt
      await subscriptionTasks.notifyUpcomingTrialEnd();
      
      // 3. Désactiver les comptes en retard de paiement
      await subscriptionTasks.deactivateOverdueAccounts();
      
      logger.info('Toutes les tâches planifiées ont été exécutées avec succès');
    } catch (error) {
      logger.error('Erreur lors de l\'exécution des tâches planifiées:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Africa/Abidjan' // Fuseau horaire de la Côte d'Ivoire
  });
  
  logger.info('Planificateur de tâches démarré avec succès');
  
}).catch(error => {
  logger.error('Échec de la connexion à la base de données pour le planificateur de tâches:', error);
  process.exit(1);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Rejet de promesse non géré à:', promise, 'raison:', reason);});

process.on('uncaughtException', (error) => {
  logger.error('Exception non capturée:', error);
  // Ne pas arrêter le processus pour les erreurs non critiques
  // process.exit(1);
});

// Gestion des signaux d'arrêt
const shutdown = async () => {
  logger.info('Arrêt du planificateur de tâches...');
  
  // Fermer la connexion à la base de données
  try {
    await mongoose.connection.close();
    logger.info('Connexion à la base de données fermée');
  } catch (error) {
    logger.error('Erreur lors de la fermeture de la connexion à la base de données:', error);
  }
  
  process.exit(0);
};

// Gestion des signaux d'arrêt
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Exporter pour les tests
module.exports = {
  subscriptionTasks,
  shutdown
};
