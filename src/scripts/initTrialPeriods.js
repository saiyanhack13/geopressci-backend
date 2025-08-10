const mongoose = require('mongoose');
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
 * Initialise la période d'essai pour les pressings qui n'en ont pas
 */
const initTrialPeriods = async () => {
  try {
    logger.info('Début de l\'initialisation des périodes d\'essai...');
    
    // Trouver les pressings sans période d'essai définie
    const pressings = await Pressing.find({
      $or: [
        { trialEndDate: { $exists: false } },
        { trialEndDate: null },
        { subscriptionPlan: { $exists: false } },
        { subscriptionPlan: null }
      ]
    });
    
    let updatedCount = 0;
    const now = new Date();
    
    for (const pressing of pressings) {
      try {
        // Définir la période d'essai à 30 jours à partir de maintenant
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        
        // Mettre à jour le pressing
        pressing.trialEndDate = trialEndDate;
        pressing.subscriptionPlan = 'essai';
        pressing.subscriptionStatus = 'trialing';
        pressing.subscriptionStartDate = now;
        
        await pressing.save();
        updatedCount++;
        
        logger.info(`Période d'essai initialisée pour le pressing ${pressing._id} jusqu'au ${trialEndDate.toLocaleDateString('fr-FR')}`);
      } catch (error) {
        logger.error(`Erreur lors de la mise à jour du pressing ${pressing._id}:`, error);
      }
    }
    
    logger.info(`Initialisation des périodes d'essai terminée. ${updatedCount} pressings mis à jour.`);
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation des périodes d\'essai:', error);
  } finally {
    // Fermer la connexion à la base de données
    await mongoose.connection.close();
    logger.info('Connexion à la base de données fermée');
  }
};

// Exécuter le script
(async () => {
  await connectDB();
  await initTrialPeriods();
  process.exit(0);
})();
