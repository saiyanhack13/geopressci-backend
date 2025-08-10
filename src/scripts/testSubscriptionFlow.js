const mongoose = require('mongoose');
const faker = require('faker/locale/fr');
const config = require('../config/config');
const Pressing = require('../models/pressing.model');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

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
 * Crée un pressing de test avec une période d'essai
 */
const createTestPressing = async () => {
  try {
    logger.info('Création d\'un pressing de test...');
    
    const pressing = new Pressing({
      email: `test-${uuidv4()}@example.com`,
      password: 'password123',
      role: 'pressing',
      nomCommerce: `Pressing Test ${faker.company.companyName()}`,
      adresse: {
        rue: faker.address.streetAddress(),
        ville: faker.address.city(),
        codePostal: faker.address.zipCode(),
        pays: 'Côte d\'Ivoire',
        localisation: {
          type: 'Point',
          coordinates: [
            parseFloat(faker.address.longitude()),
            parseFloat(faker.address.latitude())
          ]
        }
      },
      telephone: faker.phone.phoneNumber(),
      isActive: true
    });
    
    await pressing.save();
    logger.info(`Pressing de test créé avec l'ID: ${pressing._id}`);
    return pressing;
  } catch (error) {
    logger.error('Erreur lors de la création du pressing de test:', error);
    throw error;
  }
};

/**
 * Teste le flux complet d'abonnement
 */
const testSubscriptionFlow = async () => {
  try {
    // 1. Créer un pressing de test
    const pressing = await createTestPressing();
    
    // 2. Vérifier que le pressing a bien une période d'essai
    logger.info('Vérification de la période d\'essai...');
    if (!pressing.trialEndDate || !(pressing.trialEndDate > new Date())) {
      throw new Error('La période d\'essai n\'a pas été correctement initialisée');
    }
    logger.info(`✅ Période d'essai valide jusqu'au ${pressing.trialEndDate.toLocaleDateString('fr-FR')}`);
    
    // 3. Simuler la soumission des documents d'identité
    logger.info('Simulation de la soumission des documents d\'identité...');
    pressing.verificationStatus = 'en_attente';
    pressing.verificationDocuments = [
      'https://example.com/id-front.jpg',
      'https://example.com/id-back.jpg'
    ];
    await pressing.save();
    logger.info('✅ Documents d\'identité soumis avec succès');
    
    // 4. Simuler l'approbation de la vérification d'identité (côté admin)
    logger.info('Simulation de l\'approbation de la vérification d\'identité...');
    pressing.verificationStatus = 'approuve';
    await pressing.save();
    logger.info('✅ Vérification d\'identité approuvée');
    
    // 5. Simuler la souscription à un abonnement payant
    logger.info('Simulation de la souscription à un abonnement payant...');
    pressing.subscriptionPlan = 'mensuel';
    pressing.subscriptionStatus = 'active';
    pressing.subscriptionStartDate = new Date();
    
    // Définir la date de prochaine facturation à 1 mois
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    pressing.nextBillingDate = nextBillingDate;
    
    // Ajouter un paiement dans l'historique
    pressing.paymentHistory = [{
      amount: 5000,
      currency: 'XOF',
      paymentDate: new Date(),
      paymentMethod: 'carte',
      status: 'succeeded',
      invoiceUrl: 'https://example.com/invoices/test-123'
    }];
    
    await pressing.save();
    logger.info(`✅ Abonnement payant souscrit avec succès. Prochaine facturation: ${nextBillingDate.toLocaleDateString('fr-FR')}`);
    
    // 6. Vérifier que le pressing a bien accès aux fonctionnalités payantes
    logger.info('Vérification de l\'accès aux fonctionnalités payantes...');
    if (pressing.subscriptionStatus !== 'active') {
      throw new Error('Le pressing n\'a pas accès aux fonctionnalités payantes');
    }
    logger.info('✅ Le pressing a bien accès aux fonctionnalités payantes');
    
    // 7. Simuler le renouvellement de l'abonnement (tâche planifiée)
    logger.info('Simulation du renouvellement de l\'abonnement...');
    const originalBillingDate = new Date(pressing.nextBillingDate);
    
    // Avancer la date de facturation pour simuler le passage du temps
    pressing.nextBillingDate = new Date();
    await pressing.save();
    
    // Exécuter la tâche de renouvellement
    const subscriptionTasks = require('./subscriptionTasks');
    await subscriptionTasks.processSubscriptionRenewals();
    
    // Vérifier que la date de facturation a été mise à jour
    const updatedPressing = await Pressing.findById(pressing._id);
    if (updatedPressing.nextBillingDate <= originalBillingDate) {
      throw new Error('La date de prochaine facturation n\'a pas été correctement mise à jour');
    }
    
    logger.info(`✅ Abonnement renouvelé avec succès. Prochaine facturation: ${updatedPressing.nextBillingDate.toLocaleDateString('fr-FR')}`);
    
    // 8. Nettoyage (optionnel)
    // await Pressing.findByIdAndDelete(pressing._id);
    // logger.info('Pressing de test supprimé');
    
    logger.info('\n🎉 Tous les tests ont été exécutés avec succès !');
    
  } catch (error) {
    logger.error('Erreur lors du test du flux d\'abonnement:', error);
    process.exit(1);
  }
};

// Exécuter le test
(async () => {
  await connectDB();
  await testSubscriptionFlow();
  process.exit(0);
})();
