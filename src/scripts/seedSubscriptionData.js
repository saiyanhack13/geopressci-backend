const mongoose = require('mongoose');
const faker = require('faker/locale/fr');
const config = require('../config/config');
const Pressing = require('../models/pressing.model');
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
 * Génère des données de test pour les abonnements et la facturation
 */
const seedSubscriptionData = async () => {
  try {
    logger.info('Début de la génération des données de test pour les abonnements...');
    
    // Récupérer tous les pressings
    const pressings = await Pressing.find({});
    
    if (pressings.length === 0) {
      logger.warn('Aucun pressing trouvé dans la base de données');
      return;
    }
    
    const now = new Date();
    let updatedCount = 0;
    
    for (const pressing of pressings) {
      try {
        // Ne pas modifier les pressings qui ont déjà des données d'abonnement
        if (pressing.paymentHistory && pressing.paymentHistory.length > 0) {
          continue;
        }
        
        // Générer des données aléatoires pour l'abonnement
        const subscriptionStatus = faker.random.arrayElement(['trialing', 'active', 'past_due', 'canceled']);
        const subscriptionPlan = faker.random.arrayElement(['essai', 'mensuel', 'annuel']);
        
        // Définir les dates d'abonnement
        const subscriptionStartDate = faker.date.past(1);
        let trialEndDate, nextBillingDate, subscriptionEndDate = null;
        
        if (subscriptionStatus === 'trialing') {
          // Période d'essai en cours
          trialEndDate = faker.date.future(0.1, subscriptionStartDate);
        } else if (subscriptionStatus === 'active') {
          // Abonnement actif
          trialEndDate = faker.date.past(0.5, subscriptionStartDate);
          nextBillingDate = faker.date.future(0.2);
        } else if (subscriptionStatus === 'past_due') {
          // Paiement en retard
          trialEndDate = faker.date.past(1, subscriptionStartDate);
          nextBillingDate = faker.date.past(0.1);
        } else {
          // Abonnement annulé
          trialEndDate = faker.date.past(1, subscriptionStartDate);
          subscriptionEndDate = faker.date.between(trialEndDate, now);
        }
        
        // Générer l'historique des paiements
        const paymentHistory = [];
        if (subscriptionStatus !== 'trialing') {
          // Ajouter des paiements pour les abonnements non-essai
          const paymentCount = faker.random.number({ min: 1, max: 12 });
          
          for (let i = 0; i < paymentCount; i++) {
            const paymentDate = faker.date.between(
              subscriptionStartDate,
              subscriptionStatus === 'canceled' ? subscriptionEndDate : now
            );
            
            paymentHistory.push({
              amount: 5000, // 5000 XOF
              currency: 'XOF',
              paymentDate,
              paymentMethod: faker.random.arrayElement(['carte', 'mobile_money', 'virement']),
              status: faker.random.arrayElement(['succeeded', 'pending', 'failed']),
              invoiceUrl: `https://example.com/invoices/${faker.random.uuid()}`,
            });
          }
        }
        
        // Mettre à jour le pressing avec les données d'abonnement
        pressing.subscriptionPlan = subscriptionPlan;
        pressing.subscriptionStatus = subscriptionStatus;
        pressing.subscriptionStartDate = subscriptionStartDate;
        pressing.trialEndDate = trialEndDate;
        
        if (nextBillingDate) pressing.nextBillingDate = nextBillingDate;
        if (subscriptionEndDate) pressing.subscriptionEndDate = subscriptionEndDate;
        if (paymentHistory.length > 0) pressing.paymentHistory = paymentHistory;
        
        await pressing.save();
        updatedCount++;
        
        logger.info(`Données d'abonnement générées pour le pressing ${pressing._id} (${pressing.nomCommerce})`);
      } catch (error) {
        logger.error(`Erreur lors de la mise à jour du pressing ${pressing._id}:`, error);
      }
    }
    
    logger.info(`Génération des données d'abonnement terminée. ${updatedCount} pressings mis à jour.`);
  } catch (error) {
    logger.error('Erreur lors de la génération des données de test:', error);
  } finally {
    // Fermer la connexion à la base de données
    await mongoose.connection.close();
    logger.info('Connexion à la base de données fermée');
  }
};

// Exécuter le script
(async () => {
  await connectDB();
  await seedSubscriptionData();
  process.exit(0);
})();
