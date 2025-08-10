const mongoose = require('mongoose');
const config = require('../config/config');
const Pressing = require('../models/pressing.model');
const notificationController = require('../controllers/notification.controller');
const logger = require('../utils/logger');

// Connexion à la base de données
const connectDB = async () => {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info('Connecté à la base de données avec succès');
  } catch (error) {
    logger.error('Erreur de connexion à la base de données:', error);
    process.exit(1);
  }
};

/**
 * Tâche pour traiter les renouvellements d'abonnement
 * Doit être exécutée quotidiennement
 */
const processSubscriptionRenewals = async () => {
  try {
    logger.info('Début du traitement des renouvellements d\'abonnement...');
    
    // Trouver tous les pressings avec un abonnement actif ou en période d'essai
    const pressings = await Pressing.find({
      $or: [
        { subscriptionStatus: 'active' },
        { subscriptionStatus: 'trialing' }
      ]
    });
    
    const now = new Date();
    let renewedCount = 0;
    let trialEndedCount = 0;
    let paymentFailedCount = 0;
    
    for (const pressing of pressings) {
      try {
        // Vérifier si la période d'essai est terminée
        if (pressing.subscriptionStatus === 'trialing' && pressing.trialEndDate <= now) {
          // Marquer l'essai comme terminé
          pressing.subscriptionStatus = 'incomplete';
          await pressing.save();
          trialEndedCount++;
          
          // Envoyer une notification au pressing
          await notificationController.sendCustomNotification(
            pressing,
            {
              subject: 'Période d\'essai terminée',
              message: 'Votre période d\'essai est terminée. Veuillez souscrire à un abonnement pour continuer à utiliser nos services.',
              type: 'both',
            }
          );
          continue;
        }
        
        // Vérifier si c'est le jour de facturation pour les abonnements actifs
        if (pressing.subscriptionStatus === 'active' && pressing.nextBillingDate <= now) {
          // Ici, vous intégreriez normalement avec l'API de paiement pour prélever le montant
          // Pour l'exemple, nous simulons un paiement réussi
          const paymentSucceeded = true; // Remplacer par la logique de paiement réelle
          
          if (paymentSucceeded) {
            // Mettre à jour la date de prochaine facturation (1 mois plus tard)
            const nextBilling = new Date(pressing.nextBillingDate);
            nextBilling.setMonth(nextBilling.getMonth() + 1);
            
            // Enregistrer le paiement dans l'historique
            pressing.paymentHistory.push({
              amount: 5000, // 5000 XOF
              currency: 'XOF',
              paymentDate: new Date(),
              paymentMethod: pressing.paymentMethod?.type || 'carte',
              status: 'paid',
              invoiceUrl: `https://example.com/invoices/${Date.now()}`,
            });
            
            pressing.nextBillingDate = nextBilling;
            await pressing.save();
            renewedCount++;
            
            // Envoyer une notification de confirmation de paiement
            await notificationController.sendCustomNotification(
              pressing,
              {
                subject: 'Paiement de votre abonnement',
                message: `Le paiement de votre abonnement mensuel de 5000 XOF a été effectué avec succès. Prochaine échéance: ${nextBilling.toLocaleDateString('fr-FR')}`,
                type: 'email',
              }
            );
          } else {
            // En cas d'échec de paiement
            pressing.subscriptionStatus = 'past_due';
            await pressing.save();
            paymentFailedCount++;
            
            // Envoyer une notification d'échec de paiement
            await notificationController.sendCustomNotification(
              pressing,
              {
                subject: 'Échec de paiement',
                message: 'Le paiement de votre abonnement a échoué. Veuillez mettre à jour vos informations de paiement pour éviter toute interruption de service.',
                type: 'both',
              }
            );
          }
        }
      } catch (error) {
        logger.error(`Erreur lors du traitement du pressing ${pressing._id}:`, error);
      }
    }
    
    logger.info(`Traitement des renouvellements terminé. ${renewedCount} abonnements renouvelés, ${trialEndedCount} périodes d'essai terminées, ${paymentFailedCount} échecs de paiement.`);
  } catch (error) {
    logger.error('Erreur lors du traitement des renouvellements d\'abonnement:', error);
  } finally {
    // Ne pas fermer la connexion ici pour permettre d'autres opérations
  }
};

/**
 * Tâche pour notifier les pressings dont la période d'essai se termine bientôt
 * Doit être exécutée quotidiennement
 */
const notifyUpcomingTrialEnd = async () => {
  try {
    logger.info('Début de la notification de fin de période d\'essai...');
    
    // Date dans 3 jours
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    // Trouver les pressings dont la période d'essai se termine dans 3 jours
    const pressings = await Pressing.find({
      subscriptionStatus: 'trialing',
      trialEndDate: {
        $lte: threeDaysFromNow,
        $gte: new Date() // S'assurer que la date n'est pas déjà passée
      },
      'notifications.trialEnding': { $ne: true } // Ne pas notifier plusieurs fois
    });
    
    let notifiedCount = 0;
    
    for (const pressing of pressings) {
      try {
        // Envoyer une notification
        await notificationController.sendCustomNotification(
          pressing,
          {
            subject: 'Votre période d\'essai se termine bientôt',
            message: `Votre période d'essai gratuite se termine le ${new Date(pressing.trialEndDate).toLocaleDateString('fr-FR')}. Pensez à souscrire à un abonnement pour continuer à profiter de nos services sans interruption.`,
            type: 'both',
          }
        );
        
        // Marquer comme notifié pour éviter les doublons
        if (!pressing.notifications) pressing.notifications = {};
        pressing.notifications.trialEnding = true;
        await pressing.save();
        
        notifiedCount++;
      } catch (error) {
        logger.error(`Erreur lors de la notification du pressing ${pressing._id}:`, error);
      }
    }
    
    logger.info(`Notification de fin de période d'essai terminée. ${notifiedCount} pressings notifiés.`);
  } catch (error) {
    logger.error('Erreur lors de la notification de fin de période d\'essai:', error);
  }
};

/**
 * Tâche pour désactiver les comptes en retard de paiement
 * Doit être exécutée quotidiennement
 */
const deactivateOverdueAccounts = async () => {
  try {
    logger.info('Début de la désactivation des comptes en retard de paiement...');
    
    // Date il y a 7 jours
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Trouver les comptes en retard de paiement depuis plus de 7 jours
    const pressings = await Pressing.find({
      subscriptionStatus: 'past_due',
      updatedAt: { $lte: sevenDaysAgo },
      isActive: true
    });
    
    let deactivatedCount = 0;
    
    for (const pressing of pressings) {
      try {
        // Désactiver le compte
        pressing.isActive = false;
        await pressing.save();
        deactivatedCount++;
        
        // Envoyer une notification
        await notificationController.sendCustomNotification(
          pressing,
          {
            subject: 'Compte désactivé - Paiement en retard',
            message: 'Votre compte a été désactivé en raison d\'un impayé. Veuillez nous contacter pour régulariser votre situation.',
            type: 'both',
          }
        );
      } catch (error) {
        logger.error(`Erreur lors de la désactivation du pressing ${pressing._id}:`, error);
      }
    }
    
    logger.info(`Désactivation des comptes en retard terminée. ${deactivatedCount} comptes désactivés.`);
  } catch (error) {
    logger.error('Erreur lors de la désactivation des comptes en retard de paiement:', error);
  }
};

// Exporter les tâches pour une utilisation avec un planificateur de tâches (ex: node-cron)
module.exports = {
  connectDB,
  processSubscriptionRenewals,
  notifyUpcomingTrialEnd,
  deactivateOverdueAccounts,
  
  // Fonction pour exécuter toutes les tâches (utile pour les tests)
  runAllTasks: async () => {
    await connectDB();
    await processSubscriptionRenewals();
    await notifyUpcomingTrialEnd();
    await deactivateOverdueAccounts();
    
    // Attendre que toutes les opérations asynchrones soient terminées avant de fermer la connexion
    setTimeout(() => {
      mongoose.connection.close();
      logger.info('Toutes les tâches ont été exécutées avec succès');
    }, 5000);
  },
};
