const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { validationResult, matchedData } = require('express-validator');
const crypto = require('crypto');
const Admin = require('../models/admin.model');
const User = require('../models/user.model').User;
const Client = require('../models/client.model');
const Pressing = require('../models/pressing.model');
const config = require('../config/config');
const logger = require('../utils/logger');
const { getGeocode } = require('../services/geocoding.service');
const notificationController = require('./notification.controller');
const ApiError = require('../utils/ApiError');
const { catchAsync } = require('../utils/error.utils');
const httpStatus = require('http-status');

// Constantes pour les statuts utilisateur
const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending'
};

// Constantes pour les types d'utilisateurs
const USER_TYPES = {
  CLIENT: 'client',
  PRESSING: 'pressing',
  ADMIN: 'admin'
};

// Générer un JWT
const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    type: user.constructor.modelName.toLowerCase()
  };
  
  // Ajouter le pressingId pour les utilisateurs pressing
  if (user.role === 'pressing') {
    // Si l'utilisateur est un pressing, son ID est le pressingId
    payload.pressingId = user._id;
    
    // Si l'utilisateur pressing a une référence à un pressing séparé, l'utiliser
    if (user.pressing) {
      payload.pressingId = user.pressing;
    }
  }
  
  // Options du token
  const options = {
    expiresIn: config.jwt.expiresIn,
    issuer: 'geopressci-api',
    audience: user.role
  };
  
  return jwt.sign(payload, config.jwt.secret, options);
};



/**
 * @swagger
 * /auth/register/client:
 *   post:
 *     summary: Inscription d'un nouveau client
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nom
 *               - prenom
 *               - email
 *               - telephone
 *               - password
 *               - adresse
 *             properties:
 *               nom:
 *                 type: string
 *                 example: 'Doe'
 *               prenom:
 *                 type: string
 *                 example: 'John'
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'client@example.com'
 *               telephone:
 *                 type: string
 *                 example: '+2250700000000'
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: 'password123'
 *               adresse:
 *                 type: string
 *                 example: "Cocody, Abidjan, Côte d'Ivoire"
 *     responses:
 *       201:
 *         description: Client enregistré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *                 user:
 *                   $ref: '#/components/schemas/Client'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const registerClient = async (req, res, next) => {
  try {
    logger.info('🔄 Début inscription client:', req.body);
    
    // Note: La validation est déjà faite par le middleware, donc pas besoin de re-valider ici
    const data = matchedData(req);
    const { nom, prenom, email, telephone, password, adresse } = data;

    logger.info('✅ Données validées:', { nom, prenom, email, telephone, adresse });

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await Client.findOne({ email });
    if (existingUser) {
      logger.warn('⚠️ Email déjà utilisé:', email);
      return res.status(400).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà',
        field: 'email'
      });
    }

    // Obtenir les coordonnées géographiques à partir de l'adresse
    let coordinates = [0, 0]; // Valeurs par défaut
    try {
      const location = await getGeocode(adresse);
      if (location) {
        coordinates = [location.lng, location.lat];
      } else {
        logger.warn(`Impossible de géolocaliser l'adresse: ${adresse}`);
      }
    } catch (error) {
      logger.error('Erreur lors de la géolocalisation:', error);
      // On continue malgré l'erreur, les coordonnées restent à 0,0
    }

    // Préparer les données du client
    const clientData = {
      nom,
      prenom,
      email,
      phone: telephone,
      password,
      addresses: [
        {
          type: 'home',
          label: 'Domicile',
          street: adresse,
          city: data.ville || 'Ville non spécifiée',
          postalCode: data.codePostal || '0000',
          country: data.pays || 'Côte d\'Ivoire',
          location: {
            type: 'Point',
            coordinates,
          },
          isDefault: true,
        },
      ],
    };
    
    // Créer un nouveau client dans une transaction
    const session = await mongoose.startSession();
    let transactionCompleted = false;
    
    try {
      session.startTransaction();
      
      const client = await Client.create([clientData], { session });
      
      await session.commitTransaction();
      transactionCompleted = true;
      session.endSession();
      
      logger.info('✅ Client créé avec succès:', {
        id: client[0]._id,
        email: client[0].email,
        nom: client[0].nom,
        prenom: client[0].prenom
      });
      
      // Générer le token JWT
      const token = generateToken(client[0]);
      logger.info('🔑 Token généré avec succès');
      
      // Réponse avec les données du client (sans le mot de passe)
      const clientResponse = client[0].toObject();
      delete clientResponse.password;
      
      // Envoyer une notification de bienvenue (ne pas attendre la fin de l'envoi)
      notificationController.sendWelcomeNotification(client[0])
        .then(() => logger.info('📧 Notification de bienvenue envoyée avec succès'))
        .catch(error => 
          logger.error('📧 Erreur lors de l\'envoi de la notification de bienvenue:', error)
        );
      
      // Réponse de succès
      res.status(201).json({
        success: true,
        token,
        data: clientResponse,
        message: 'Inscription réussie ! Bienvenue sur Geopressci 🎉'
      });
      
    } catch (error) {
      // N'avorter la transaction que si elle n'a pas été commitée
      if (!transactionCompleted && session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      
      logger.error('❌ Erreur dans la transaction de création de client:', error);
      throw error; // Laisser le gestionnaire d'erreurs global le gérer
    }

  } catch (error) {
    next(error);
  }
};

/**
 * Inscription d'un nouveau pressing
 * @route POST /api/v1/auth/register/pressing
 * @access Public
 */
const registerPressing = async (req, res, next) => {
  try {
    // Validation des données d'entrée
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Données invalides', errors.array());
    }
    
    const data = matchedData(req);
    const { 
      prenom,
      nom,
      nomCommerce, 
      email, 
      telephone, 
      password, 
      adresse,
      coordinates, // Coordonnées du frontend
      services 
    } = data;

    // Vérifier si un utilisateur avec cet email existe déjà (toutes collections)
    console.log('🔍 Vérification email:', email);
    
    // Vérifier dans les trois collections séparées
    const [existingAdmin, existingPressing, existingClient] = await Promise.all([
      Admin.findOne({ email }),
      Pressing.findOne({ email }),
      Client.findOne({ email })
    ]);
    
    console.log('👤 Admin existant:', existingAdmin ? 'TROUVÉ' : 'AUCUN');
    console.log('🏪 Pressing existant:', existingPressing ? 'TROUVÉ' : 'AUCUN');
    console.log('👥 Client existant:', existingClient ? 'TROUVÉ' : 'AUCUN');
    
    if (existingAdmin || existingPressing || existingClient) {
      console.log('❌ Email déjà utilisé, arrêt de l\'inscription');
      throw new ApiError(httpStatus.CONFLICT, 'Un utilisateur avec cet email existe déjà');
    }
    
    console.log('✅ Email disponible, poursuite de l\'inscription');

    // Gestion des coordonnées géographiques
    let finalCoordinates = [0, 0];
    
    // Priorité aux coordonnées du frontend (géolocalisation forcée)
    if (coordinates && coordinates.lat && coordinates.lng) {
      finalCoordinates = [coordinates.lng, coordinates.lat];
      console.log('📍 Coordonnées du frontend utilisées:', finalCoordinates);
    } else {
      // Fallback: géocodage de l'adresse
      try {
        const location = await getGeocode(adresse);
        if (location) {
          finalCoordinates = [location.lng, location.lat];
          console.log('🌍 Coordonnées géocodées:', finalCoordinates);
        }
      } catch (error) {
        logger.error('Erreur lors de la géolocalisation du pressing:', error);
        // Coordonnées par défaut pour Abidjan si tout échoue
        finalCoordinates = [-4.0267, 5.3364]; // Cocody par défaut
        console.log('⚠️ Coordonnées par défaut utilisées:', finalCoordinates);
      }
    }

    // Détecter le quartier basé sur les coordonnées
    const detectDistrict = (lat, lng) => {
      // Yopougon
      if (lat >= 5.32 && lat <= 5.36 && lng >= -4.12 && lng <= -4.08) return 'Yopougon';
      // Cocody
      if (lat >= 5.35 && lat <= 5.38 && lng >= -4.02 && lng <= -3.98) return 'Cocody';
      // Plateau
      if (lat >= 5.31 && lat <= 5.33 && lng >= -4.04 && lng <= -4.02) return 'Plateau';
      // Adjamé
      if (lat >= 5.34 && lat <= 5.36 && lng >= -4.05 && lng <= -4.03) return 'Adjamé';
      // Treichville
      if (lat >= 5.28 && lat <= 5.31 && lng >= -4.04 && lng <= -4.01) return 'Treichville';
      // Marcory
      if (lat >= 5.28 && lat <= 5.31 && lng >= -4.01 && lng <= -3.98) return 'Marcory';
      // Défaut
      return 'Abidjan';
    };
    
    const detectedDistrict = detectDistrict(finalCoordinates[1], finalCoordinates[0]);
    console.log('🏘️ Quartier détecté:', detectedDistrict);
    
    // Préparer les données du pressing (discriminator de User)
    const pressingData = {
      // Champs de base hérités de User
      prenom: prenom || 'Propriétaire',
      nom: nom || nomCommerce,
      email,
      phone: telephone, // Utilise le champ phone de User
      password,
      role: 'pressing', // Discriminator key
      
      // Champs spécifiques au Pressing
      businessName: nomCommerce,
      businessPhone: telephone.replace(/^\+225/, ''), // Champ optionnel spécifique au pressing
      
      // Structure address conforme au modèle avec géolocalisation
      address: {
        street: adresse,
        city: data.ville || 'Abidjan',
        district: detectedDistrict,
        postalCode: data.codePostal || '00225',
        country: data.pays || 'Côte d\'Ivoire',
        coordinates: {
          type: 'Point',
          coordinates: finalCoordinates,
        },
        formattedAddress: `${detectedDistrict}, ${adresse}`
      },
      
      // Champs requis avec valeurs par défaut
      description: `Pressing ${nomCommerce} situé à ${adresse}`,
      
      // Configuration par défaut
      businessHours: [
        { day: 'lundi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'mardi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'mercredi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'jeudi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'vendredi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'samedi', open: '08:00', close: '16:00', isClosed: false },
        { day: 'dimanche', open: '00:00', close: '00:00', isClosed: true }
      ],
      
      // Services de base si fournis
      services: services ? services.map(service => ({
        name: service.nom,
        description: service.description,
        price: service.prix,
        category: service.category,
        duration: service.duration || 60,
        isAvailable: service.isAvailable !== false
      })) : [],
      
      // Options de livraison par défaut
      deliveryOptions: {
        isAvailable: false,
        freeDeliveryThreshold: 10000, // 10,000 FCFA
        deliveryFee: 1000, // 1,000 FCFA
        maxDeliveryDistance: 10, // 10 km
        estimatedDeliveryTime: 120 // 2 heures
      },
      
      // Statut par défaut
      status: 'pending', // En attente d'approbation
      isVerified: false,
      
      // Métadonnées de géolocalisation
      geolocationAccuracy: coordinates?.accuracy || null,
      geolocationSource: coordinates ? 'frontend' : 'geocoding'
    };

    // Créer le pressing dans une transaction
    const session = await mongoose.startSession();
    let transactionCompleted = false;
    
    try {
      session.startTransaction();
      console.log('🚀 Début de la transaction MongoDB');
      
      // Créer le pressing dans la collection séparée 'pressings'
      console.log('📝 Création du pressing avec les données:', {
        email: pressingData.email,
        businessName: pressingData.businessName,
        phone: pressingData.phone, // Champ User
        businessPhone: pressingData.businessPhone, // Champ Pressing
        district: pressingData.address.district,
        coordinates: pressingData.address.coordinates.coordinates
      });
      
      const pressing = await Pressing.create([pressingData], { session });
      console.log('✅ Pressing créé avec ID:', pressing[0]._id);
      console.log('📍 Coordonnées enregistrées:', pressing[0].address.coordinates.coordinates);
      console.log('🏘️ Quartier enregistré:', pressing[0].address.district);
      
      // Si des services sont fournis, les ajouter
      if (services && services.length > 0) {
        console.log('📋 Services à ajouter:', services.length);
        // Ici, vous pourriez ajouter la logique pour créer les services associés
        // Par exemple : await Service.create([...services], { session });
      }
      
      await session.commitTransaction();
      transactionCompleted = true;
      console.log('✅ Transaction commitée avec succès');
      
      // Envoyer une notification de bienvenue (après la transaction)
      notificationController.sendWelcomeNotification(pressing[0])
        .then(() => logger.info('Notification de bienvenue envoyée au pressing'))
        .catch(error => 
          logger.error('Erreur lors de l\'envoi de la notification au pressing:', error)
        );
      
      // Générer le token JWT
      const token = generateToken(pressing[0]);
      console.log('🔑 Token JWT généré');
      
      // Réponse avec les données du pressing (sans le mot de passe)
      const pressingResponse = pressing[0].toObject();
      delete pressingResponse.password;
      
      console.log('🎉 Inscription pressing réussie pour:', pressingResponse.email);
      
      res.status(201).json({
        success: true,
        message: '🎉 Inscription pressing réussie ! Bienvenue sur Geopressci',
        token,
        accessToken: token, // Compatibilité frontend
        data: pressingResponse,
        user: pressingResponse, // Compatibilité frontend
        userType: 'pressing'
      });
      
    } catch (error) {
      console.log('❌ Erreur dans la transaction:', error.message);
      
      // Seulement avorter si la transaction n'a pas été commitée
      if (!transactionCompleted && session.inTransaction()) {
        console.log('🔄 Annulation de la transaction...');
        await session.abortTransaction();
      }
      
      throw error;
    } finally {
      console.log('🔚 Fermeture de la session MongoDB');
      await session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Connexion d'un utilisateur (client, pressing ou admin)
 * @route POST /api/v1/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    // Validation des données d'entrée
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Données invalides', errors.array());
    }
    
    const { email, password, userType } = matchedData(req);

    // 1) Vérifier si l'utilisateur existe
    // Avec les discriminateurs, on peut requêter le modèle de base User
    let user;
    console.log('🔍 Recherche utilisateur:', { email, userType });
    
    if (userType === 'admin') {
      // Le modèle Admin est séparé
      user = await Admin.findOne({ email }).select('+password');
      console.log('👤 Admin trouvé:', user ? 'OUI' : 'NON');
    } else {
      // Pour les clients et pressings, essayons d'abord avec le modèle Client directement
      console.log('📋 Recherche avec modèle Client...');
      user = await Client.findOne({ email }).select('+password');
      console.log('👤 Client trouvé:', user ? 'OUI' : 'NON');
      
      // Si pas trouvé avec Client, essayons avec Pressing
      if (!user && userType === 'pressing') {
        console.log('📋 Recherche avec modèle Pressing...');
        user = await Pressing.findOne({ email }).select('+password');
        console.log('👤 Pressing trouvé:', user ? 'OUI' : 'NON');
      }
      
      // Si toujours pas trouvé, essayons avec mongoose directement dans différentes collections
      if (!user) {
        console.log('🔧 Recherche directe dans les collections...');
        const mongoose = require('mongoose');
        
        // Essayer collection 'pressings'
        let directUser = await mongoose.connection.db.collection('pressings').findOne({ email });
        console.log('🏢 Collection pressings:', directUser ? { _id: directUser._id, email: directUser.email, role: directUser.role } : 'NON');
        
        // Essayer collection 'clients'
        if (!directUser) {
          directUser = await mongoose.connection.db.collection('clients').findOne({ email });
          console.log('👤 Collection clients:', directUser ? { _id: directUser._id, email: directUser.email, role: directUser.role } : 'NON');
        }
        
        // Si trouvé dans une collection, utilisons-le
        if (directUser) {
          console.log('🎉 Utilisateur trouvé ! Création d\'un objet utilisateur temporaire...');
          console.log('🔑 Mot de passe stocké:', directUser.password ? directUser.password.substring(0, 10) + '...' : 'ABSENT');
          
          // Créer un objet pressing temporaire avec les méthodes nécessaires
          user = {
            ...directUser,
            constructor: {
              modelName: 'Pressing'
            },
            comparePassword: async function(candidatePassword) {
              console.log('🔍 Comparaison mot de passe:', { candidatePassword, storedPassword: this.password?.substring(0, 10) + '...' });
              
              // Si le mot de passe stocké est en texte clair (pas de hash bcrypt)
              if (this.password && !this.password.startsWith('$2')) {
                console.log('📝 Mot de passe en texte clair détecté');
                return candidatePassword === this.password;
              } else {
                console.log('🔒 Mot de passe hashé détecté');
                const bcrypt = require('bcryptjs');
                return await bcrypt.compare(candidatePassword, this.password);
              }
            },
            save: async function(options) {
              // Mettre à jour directement dans la base de données
              const mongoose = require('mongoose');
              await mongoose.connection.db.collection('pressings').updateOne(
                { _id: this._id },
                { $set: { lastLogin: this.lastLogin } }
              );
              return this;
            },
            toObject: function() {
              // Retourner une copie de l'objet sans les méthodes
              const obj = { ...this };
              delete obj.comparePassword;
              delete obj.save;
              delete obj.toObject;
              return obj;
            }
          };
        }
      }
    }

    if (!user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Identifiants invalides');
    }
    
    // 2) Vérifier si le mot de passe est correct
    let isMatch;
    // Le modèle Admin peut avoir une méthode différente des modèles User/Pressing
    if (user.matchPassword) {
      isMatch = await user.matchPassword(password);
    } else {
      isMatch = await user.comparePassword(password);
    }

    if (!isMatch) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Identifiants invalides');
    }
    
    // 3) Vérifier si le compte est actif
    if (user.status && user.status !== 'active') {
      throw new ApiError(
        httpStatus.FORBIDDEN, 
        'Votre compte est désactivé. Veuillez contacter le support.'
      );
    }
    
    // 4) Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    
    // 5) Générer le token JWT
    const token = generateToken(user);
    
    // 6) Préparer la réponse
    const userResponse = user.toObject();
    delete userResponse.password;
    
    // Normaliser les champs pour la compatibilité frontend
    const normalizedUser = {
      ...userResponse,
      // Assurer que 'telephone' est présent (le frontend l'attend)
      telephone: userResponse.telephone || userResponse.phone || userResponse.phoneNumber,
      // Garder aussi 'phone' pour compatibilité
      phone: userResponse.phone || userResponse.telephone || userResponse.phoneNumber
    };
    
    res.status(200).json({
      success: true,
      token,
      data: normalizedUser,
      // Ajouter le token aussi directement pour compatibilité
      accessToken: token,
      user: normalizedUser
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer l'utilisateur connecté
 * @route GET /api/v1/auth/me
 * @access Privé
 */
const getMe = async (req, res, next) => {
  try {
    // L'utilisateur a déjà été trouvé et attaché par le middleware d'authentification
    const user = req.user;
    
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Utilisateur non trouvé');
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * Demander une réinitialisation de mot de passe
 * @route POST /api/v1/auth/forgot-password
 * @access Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    // Validation des données d'entrée
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Données invalides', errors.array());
    }
    
    const { email } = matchedData(req);
    
    // 1) Trouver l'utilisateur par email
    let user = await User.findOne({ email });
    
    // Si l'utilisateur n'est pas trouvé dans User, vérifier dans Admin
    if (!user) {
      user = await Admin.findOne({ email });
      if (!user) {
        // Ne pas révéler que l'email n'existe pas pour des raisons de sécurité
        return res.status(httpStatus.OK).json({
          success: true,
          message: 'Si votre email est enregistré, vous recevrez un lien de réinitialisation'
        });
      }
    }
    
    // 2) Générer un token de réinitialisation
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    
    try {
      // 3) Envoyer l'email de réinitialisation
      const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;
      
      await notificationController.sendPasswordResetEmail(user.email, resetUrl);
      
      res.status(httpStatus.OK).json({
        success: true,
        message: 'Un lien de réinitialisation a été envoyé à votre adresse email'
      });
      
    } catch (error) {
      // En cas d'erreur, supprimer le token
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      logger.error('Erreur lors de l\'envoi de l\'email de réinitialisation:', error);
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Une erreur est survenue lors de l\'envoi de l\'email. Veuillez réessayer plus tard.'
      );
    }
    
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /auth/reset-password/{token}:
 *   put:
 *     summary: Réinitialiser le mot de passe
 *     description: Permet à un utilisateur de réinitialiser son mot de passe en utilisant un jeton de réinitialisation valide
 *     tags: [Authentification]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Jeton de réinitialisation de mot de passe reçu par email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmPassword
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: Nouveau mot de passe
 *                 example: 'nouveauMotDePasse123'
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: Confirmation du nouveau mot de passe
 *                 example: 'nouveauMotDePasse123'
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   description: JWT pour connexion automatique
 *                   example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *                 message:
 *                   type: string
 *                   example: 'Votre mot de passe a été réinitialisé avec succès'
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: '507f1f77bcf86cd799439011'
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: 'utilisateur@example.com'
 *                     role:
 *                       type: string
 *                       enum: [client, pressing, admin]
 *                       example: 'client'
 *       400:
 *         description: Données invalides ou jetons invalides/expirés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Les mots de passe ne correspondent pas'
 *       401:
 *         description: Lien de réinitialisation invalide ou expiré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Le lien de réinitialisation est invalide ou a expiré'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const resetPassword = async (req, res, next) => {
  try {
    // Validation des données d'entrée
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Données invalides', errors.array());
    }
    
    const { token } = req.params;
    const { password } = matchedData(req);
    
    // 1) Hasher le token pour le comparer avec celui en base
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // 2) Trouver l'utilisateur par le token et vérifier la date d'expiration
    let user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    // Si l'utilisateur n'est pas trouvé dans User, vérifier dans Admin
    if (!user) {
      user = await Admin.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
      
      if (!user) {
        throw new ApiError(
          httpStatus.BAD_REQUEST, 
          'Le token est invalide ou a expiré. Veuillez faire une nouvelle demande.'
        );
      }
    }
    
    // 3) Mettre à jour le mot de passe
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();
    
    await user.save();
    
    // 4) Envoyer une notification
    try {
      await notificationController.sendPasswordChangedConfirmation(user.email);
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de la confirmation de changement de mot de passe:', error);
      // Ne pas échouer la requête si l'envoi de l'email échoue
    }
    
    // 5) Générer un nouveau token pour une connexion automatique
    const authToken = generateToken(user);
    
    res.status(200).json({
      success: true,
      token: authToken,
      message: 'Votre mot de passe a été réinitialisé avec succès',
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// Déconnexion d'un utilisateur
// @route POST /api/v1/auth/logout
// @access Privé
const logout = async (req, res, next) => {
  try {
    // Dans une implémentation avec blacklist de tokens, on ajouterait le token à la blacklist
    // Pour l'instant, on se contente de confirmer la déconnexion côté serveur
    
    res.status(200).json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    next(error);
  }
};

// Rafraîchir le token JWT
// @route POST /api/v1/auth/refresh-token
// @access Privé
const refreshToken = async (req, res, next) => {
  try {
    // L'utilisateur est déjà vérifié par le middleware protect
    const user = req.user;
    
    // Générer un nouveau token
    const newToken = generateToken(user);
    
    res.status(200).json({
      success: true,
      token: newToken,
      message: 'Token rafraîchi avec succès',
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// Vérifier l'email d'un utilisateur
// @route POST /api/v1/auth/verify-email
// @access Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Token de vérification requis');
    }
    
    // Hasher le token pour le comparer avec celui en base
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Chercher l'utilisateur avec ce token de vérification
    let user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    // Si pas trouvé dans User, chercher dans Admin
    if (!user) {
      user = await Admin.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }
      });
    }
    
    if (!user) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Token de vérification invalide ou expiré'
      );
    }
    
    // Marquer l'email comme vérifié
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    
    await user.save();
    
    // Générer un token d'authentification
    const authToken = generateToken(user);
    
    res.status(200).json({
      success: true,
      token: authToken,
      message: 'Email vérifié avec succès',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isEmailVerified: true
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerClient,
  registerPressing,
  login,
  logout,
  refreshToken,
  verifyEmail,
  getMe,
  forgotPassword,
  resetPassword,
};
