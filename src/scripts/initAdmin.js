const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const Admin = require('../models/admin.model');
const logger = require('../utils/logger');
const readline = require('readline');

// Interface pour la lecture depuis la console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fonction pour lire une entrée utilisateur de manière asynchrone
const questionAsync = (query) => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

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
 * Vérifie si un super administrateur existe déjà
 */
const checkExistingSuperAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ isSuperAdmin: true });
    return existingAdmin ? true : false;
  } catch (error) {
    logger.error('Erreur lors de la vérification des administrateurs existants:', error);
    return false;
  }
};

/**
 * Crée un compte super administrateur
 */
const createSuperAdmin = async () => {
  try {
    // Vérifier si un super admin existe déjà
    const superAdminExists = await checkExistingSuperAdmin();
    
    if (superAdminExists) {
      logger.warn('Un super administrateur existe déjà dans le système.');
      const continueAnyway = await questionAsync('Voulez-vous créer un autre compte administrateur ? (o/n) ');
      
      if (continueAnyway.toLowerCase() !== 'o' && continueAnyway.toLowerCase() !== 'oui') {
        logger.info('Opération annulée par l\'utilisateur');
        return;
      }
    }
    
    // Demander les informations de l'administrateur
    logger.info('\n=== Création d\'un compte administrateur ===');
    
    let email = '';
    let emailValid = false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    while (!emailValid) {
      email = await questionAsync('Email: ');
      emailValid = emailRegex.test(email);
      if (!emailValid) {
        logger.error('Veuillez entrer une adresse email valide');
      }
    }
    
    let fullName = '';
    while (!fullName.trim()) {
      fullName = await questionAsync('Nom complet: ');
      if (!fullName.trim()) {
        logger.error('Le nom complet est requis');
      }
    }
    
    let password = '';
    let confirmPassword = '';
    let passwordValid = false;
    
    while (!passwordValid) {
      password = await questionAsync('Mot de passe (min. 8 caractères): ');
      
      if (password.length < 8) {
        logger.error('Le mot de passe doit contenir au moins 8 caractères');
        continue;
      }
      
      confirmPassword = await questionAsync('Confirmez le mot de passe: ');
      
      if (password !== confirmPassword) {
        logger.error('Les mots de passe ne correspondent pas');
      } else {
        passwordValid = true;
      }
    }
    
    // Demander le numéro de téléphone (optionnel)
    const phone = await questionAsync('Numéro de téléphone (optionnel): ');
    
    // Demander la confirmation
    logger.info('\nRécapitulatif:');
    logger.info(`Email: ${email}`);
    logger.info(`Nom complet: ${fullName}`);
    logger.info(`Téléphone: ${phone || 'Non fourni'}`);
    logger.info(`Rôle: ${superAdminExists ? 'Administrateur' : 'Super Administrateur'}`);
    
    const confirm = await questionAsync('\nConfirmez-vous la création de ce compte ? (o/n) ');
    
    if (confirm.toLowerCase() !== 'o' && confirm.toLowerCase() !== 'oui') {
      logger.info('Opération annulée');
      return;
    }
    
    // Créer l'administrateur
    const adminData = {
      email,
      password,
      fullName,
      isSuperAdmin: !superAdminExists, // Premier admin = super admin
      status: 'active',
      permissions: [
        'manage_pressings',
        'manage_subscriptions',
        'manage_payments',
        'manage_users',
        'view_analytics',
        'manage_content',
        'system_settings'
      ]
    };
    
    if (phone) adminData.phone = phone;
    
    const admin = await Admin.create(adminData);
    
    logger.info(`\n✅ Compte administrateur créé avec succès !`);
    logger.info(`Email: ${admin.email}`);
    logger.info(`Rôle: ${admin.isSuperAdmin ? 'Super Administrateur' : 'Administrateur'}`);
    logger.info('\nVous pouvez maintenant vous connecter au panneau d\'administration avec ces identifiants.');
    
  } catch (error) {
    logger.error('Erreur lors de la création du compte administrateur:', error);
    
    if (error.code === 11000) {
      logger.error('Erreur: Un compte avec cet email existe déjà');
    }
  } finally {
    rl.close();
  }
};

// Exécuter le script
(async () => {
  try {
    await connectDB();
    await createSuperAdmin();
    process.exit(0);
  } catch (error) {
    logger.error('Erreur inattendue:', error);
    process.exit(1);
  }
})();
