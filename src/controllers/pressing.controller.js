const Pressing = require('../models/pressing.model');
const Service = require('../models/service.model');
const Review = require('../models/review.model');
const Order = require('../models/order.model');
const DeliveryZone = require('../models/deliveryZone.model');
const Promotion = require('../models/promotion.model');
const { ErrorResponse, NotFoundError } = require('../utils/error.utils');

const mongoose = require('mongoose');
const { 
  uploadPressing, 
  uploadProfile, 
  uploadCover, 
  deleteImage, 
  extractPublicId, 
  optimizeImageUrl 
} = require('../config/cloudinary');

/**
 * @swagger
 * /pressings:
 *   get:
 *     summary: Récupérer la liste des pressings
 *     description: Récupère une liste paginée de pressings avec filtrage, tri et sélection de champs
 *     tags: [Pressings]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: select
 *         schema:
 *           type: string
 *         description: Champs à sélectionner (séparés par des virgules)
 *         example: 'nom,adresse,noteMoyenne'
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Champ de tri (préfixez par - pour un tri décroissant)
 *         example: '-noteMoyenne,createdAt'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numéro de page (par défaut 1)
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Nombre d'éléments par page (par défaut 10)
 *         example: 10
 *       - in: query
 *         name: nom
 *         schema:
 *           type: string
 *         description: Filtrer par nom de pressing (recherche insensible à la casse)
 *         example: 'Mon Pressing'
 *       - in: query
 *         name: noteMoyenne[gte]
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         description: Filtrer par note moyenne minimale
 *         example: 4
 *     responses:
 *       200:
 *         description: Liste des pressings récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Nombre de résultats sur la page actuelle
 *                   example: 5
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     next:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 2
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                     prev:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Pressing'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getPressings = async (req, res, next) => {
  try {
    // Copier l'objet de requête
    const reqQuery = { ...req.query };

    // Champs à exclure pour le filtrage
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Supprimer les champs de la requête
    removeFields.forEach(param => delete reqQuery[param]);

    // Créer une chaîne de requête
    let queryStr = JSON.stringify(reqQuery);

    // Créer des opérateurs ($gt, $gte, etc.)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // Trouver les ressources
    let query = Pressing.find(JSON.parse(queryStr));

    // Sélectionner les champs
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Trier
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Pressing.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Exécuter la requête
    const pressings = await query;

    // Résultat de la pagination
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.json({
      success: true,
      count: pressings.length,
      pagination,
      data: pressings,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Récupérer les pressings à proximité
 * @route   GET /api/v1/pressings/radius/:zipcode/:distance
 * @access  Public
 */
const getPressingsInRadius = async (req, res, next) => {
  try {
    const { zipcode, distance } = req.params;

    // Obtenir la latitude et la longitude à partir du code postal
    // Note: Dans une application réelle, vous utiliserez un service de géocodage
    // pour obtenir les coordonnées à partir du code postal
    // Ceci est une implémentation simplifiée
    const loc = {
      type: 'Point',
      coordinates: [-4.0, 5.3], // Coordonnées par défaut (Abidjan)
    };

    // Calculer le rayon en radians
    // Diviser la distance par le rayon de la Terre (6 371 km)
    const radius = distance / 6371;

    const pressings = await Pressing.find({
      'adresse.localisation': {
        $geoWithin: { $centerSphere: [[loc.coordinates[0], loc.coordinates[1]], radius] },
      },
      estApprouve: true, // Ne montrer que les pressings approuvés
    });

    res.json({
      success: true,
      count: pressings.length,
      data: pressings,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /pressings/{id}:
 *   get:
 *     summary: Récupérer un pressing par son ID
 *     description: Récupère les détails d'un pressing spécifique à partir de son identifiant unique
 *     tags: [Pressings]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing à récupérer
 *         example: 5d713995b721c3bb38c1f5d0
 *     responses:
 *       200:
 *         description: Détails du pressing récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Pressing'
 *       404:
 *         description: Aucun pressing trouvé avec cet ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Aucun pressing trouvé avec l'ID 5d713995b721c3bb38c1f5d0"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getPressing = async (req, res, next) => {
  try {
    console.log('[DEBUG] getPressing called with ID:', req.params.id);
    console.log('[DEBUG] Full request path:', req.path);
    console.log('[DEBUG] Original URL:', req.originalUrl);
    
    const pressing = await Pressing.findById(req.params.id)
      .select('-password -__v');

    if (!pressing) {
      throw new NotFoundError(`Pressing non trouvé avec l'ID ${req.params.id}`);
    }

    // Récupération des données en temps réel
    const [orders, reviews, services, stats] = await Promise.all([
      // Commandes récentes (dernières 10)
      Order.find({ pressing: req.params.id })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('customer', 'nom prenom')
        .select('orderNumber status totalAmount createdAt items'),
      
      // Avis récents (derniers 5)
      Review.find({ pressing: req.params.id })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customer', 'nom prenom')
        .select('rating comment createdAt'),
      
      // Services actifs
      Service.find({ pressing: req.params.id, disponible: true })
        .select('nom prix categorie dureeMoyenne description'),
      
      // Statistiques temps réel
      calculatePressingStats(req.params.id)
    ]);

    // Calcul du statut en temps réel
    const now = new Date();
    const currentDay = now.toLocaleDateString('fr-FR', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5);
    
    const todayHours = pressing.businessHours.find(h => h.day === currentDay);
    const isOpenNow = todayHours && !todayHours.isClosed && 
      currentTime >= todayHours.open && currentTime <= todayHours.close;

    // Enrichissement des données
    const enrichedPressing = {
      ...pressing.toObject(),
      
      // Statut en temps réel
      realTimeStatus: {
        isOpenNow,
        currentDay,
        currentTime,
        nextOpeningTime: getNextOpeningTime(pressing.businessHours, now)
      },
      
      // Statistiques temps réel
      stats: {
        totalOrders: stats.totalOrders || 0,
        completedOrders: stats.completedOrders || 0,
        pendingOrders: stats.pendingOrders || 0,
        totalRevenue: stats.totalRevenue || 0,
        averageRating: stats.averageRating || 0,
        totalReviews: stats.totalReviews || 0,
        activeServices: services.length,
        lastOrderDate: stats.lastOrderDate,
        conversionRate: stats.conversionRate || 0
      },
      
      // Commandes récentes
      recentOrders: orders,
      
      // Avis récents
      recentReviews: reviews,
      
      // Services actifs
      activeServices: services,
      
      // Métriques de performance
      performance: {
        responseTime: stats.averageResponseTime || 0,
        completionRate: stats.completionRate || 0,
        customerSatisfaction: stats.customerSatisfaction || 0,
        repeatCustomerRate: stats.repeatCustomerRate || 0
      },
      
      // Informations de dernière activité
      lastActivity: {
        lastLogin: pressing.lastLogin,
        lastOrderProcessed: stats.lastOrderProcessed,
        lastProfileUpdate: pressing.updatedAt
      }
    };

    console.log('✅ Données temps réel récupérées:', {
      ordersCount: orders.length,
      reviewsCount: reviews.length,
      servicesCount: services.length,
      isOpenNow,
      totalRevenue: stats.totalRevenue
    });

    res.json({
      success: true,
      data: enrichedPressing,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Erreur getPressing:', err);
    next(err);
  }
};

/**
 * @swagger
 * /pressings:
 *   post:
 *     summary: Créer un nouveau pressing (Admin uniquement)
 *     description: Permet à un administrateur de créer un nouveau pressing dans le système
 *     tags: [Pressings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nom
 *               - email
 *               - telephone
 *               - adresse
 *             properties:
 *               nom:
 *                 type: string
 *                 description: Nom du pressing
 *                 example: 'Pressing du Centre'
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email de contact du pressing
 *                 example: 'contact@pressing-ducentre.ci'
 *               telephone:
 *                 type: string
 *                 description: Numéro de téléphone du pressing
 *                 example: '+2250700000000'
 *               adresse:
 *                 type: string
 *                 description: Adresse complète du pressing
 *                 example: "Rue des Commerçants, Plateau, Abidjan, Côte d'Ivoire"
 *               description:
 *                 type: string
 *                 description: Description détaillée du pressing
 *                 example: 'Pressing professionnel offrant des services de qualité depuis 2010.'
 *               horairesOuverture:
 *                 type: object
 *                 description: Horaires d'ouverture du pressing
 *                 properties:
 *                   lundi:
 *                     type: string
 *                     example: '08:00-18:00'
 *                   mardi:
 *                     type: string
 *                     example: '08:00-18:00'
 *                   mercredi:
 *                     type: string
 *                     example: '08:00-18:00'
 *                   jeudi:
 *                     type: string
 *                     example: '08:00-18:00'
 *                   vendredi:
 *                     type: string
 *                     example: '08:00-18:00'
 *                   samedi:
 *                     type: string
 *                     example: '09:00-13:00'
 *                   dimanche:
 *                     type: string
 *                     example: 'Fermé'
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nom:
 *                       type: string
 *                       example: 'Nettoyage à sec'
 *                     description:
 *                       type: string
 *                       example: 'Nettoyage professionnel à sec pour vêtements délicats'
 *                     prix:
 *                       type: number
 *                       example: 2500
 *                       description: 'Prix en FCFA'
 *     responses:
 *       201:
 *         description: Pressing créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Pressing'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const createPressing = async (req, res, next) => {
  try {
    const pressing = await Pressing.create(req.body);

    res.status(201).json({
      success: true,
      data: pressing,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /pressings/{id}:
 *   put:
 *     summary: Mettre à jour un pressing
 *     description: Permet de mettre à jour les informations d'un pressing existant
 *     tags: [Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing à mettre à jour
 *         example: 5d713995b721c3bb38c1f5d0
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *                 description: Nouveau nom du pressing
 *                 example: 'Nouveau nom du pressing'
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Nouvel email de contact
 *                 example: 'nouveau@email.ci'
 *               telephone:
 *                 type: string
 *                 description: Nouveau numéro de téléphone
 *                 example: '+2250700000001'
 *               adresse:
 *                 type: string
 *                 description: Nouvelle adresse du pressing
 *                 example: 'Nouvelle adresse, Cocody, Abidjan'
 *               description:
 *                 type: string
 *                 description: Nouvelle description
 *               horairesOuverture:
 *                 type: object
 *                 description: Nouveaux horaires d'ouverture
 *                 properties:
 *                   lundi:
 *                     type: string
 *                     example: '08:30-17:30'
 *                   mardi:
 *                     type: string
 *                     example: '08:30-17:30'
 *                   mercredi:
 *                     type: string
 *                     example: '08:30-17:30'
 *                   jeudi:
 *                     type: string
 *                     example: '08:30-17:30'
 *                   vendredi:
 *                     type: string
 *                     example: '08:30-17:30'
 *                   samedi:
 *                     type: string
 *                     example: '09:00-13:00'
 *                   dimanche:
 *                     type: string
 *                     example: 'Fermé'
 *     responses:
 *       200:
 *         description: Pressing mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Pressing'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Non autorisé à modifier ce pressing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'Non autorisé à modifier ce pressing'
 *       404:
 *         description: Aucun pressing trouvé avec cet ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Aucun pressing trouvé avec l'ID 5d713995b721c3bb38c1f5d0"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updatePressing = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est le propriétaire ou un admin
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      throw new ErrorResponse(`Non autorisé à mettre à jour ce pressing`, 403);
    }

    const pressing = await Pressing.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!pressing) {
      throw new NotFoundError(`Pressing non trouvé avec l'ID ${req.params.id}`);
    }

    res.json({
      success: true,
      data: pressing,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /pressings/{id}:
 *   delete:
 *     summary: Supprimer un pressing (Admin uniquement)
 *     description: Permet à un administrateur de supprimer définitivement un pressing du système
 *     tags: [Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing à supprimer
 *         example: 5d713995b721c3bb38c1f5d0
 *     responses:
 *       200:
 *         description: Pressing supprimé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   example: {}
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Aucun pressing trouvé avec cet ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Aucun pressing trouvé avec l'ID 5d713995b721c3bb38c1f5d0"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deletePressing = async (req, res, next) => {
  try {
    const pressing = await Pressing.findById(req.params.id);

    if (!pressing) {
      throw new NotFoundError(`Pressing non trouvé avec l'ID ${req.params.id}`);
    }

    await pressing.remove();

    res.json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};



/**
 * @swagger
 * /pressings/{id}/services:
 *   post:
 *     summary: Ajouter un nouveau service à un pressing
 *     description: Permet au propriétaire d'un pressing d'ajouter un nouveau service à son catalogue
 *     tags: [Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing
 *         example: 5d713995b721c3bb38c1f5d0
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nom
 *               - description
 *               - prix
 *             properties:
 *               nom:
 *                 type: string
 *                 description: Nom du service
 *                 example: 'Nettoyage à sec'
 *               description:
 *                 type: string
 *                 description: Description détaillée du service
 *                 example: 'Nettoyage professionnel à sec pour vêtements délicats'
 *               prix:
 *                 type: number
 *                 minimum: 0
 *                 description: Prix du service en FCFA
 *                 example: 3500
 *               dureeMoyenne:
 *                 type: number
 *                 description: 'Durée moyenne en heures (optionnel)'
 *                 example: 24
 *               disponible:
 *                 type: boolean
 *                 description: Indique si le service est actuellement disponible
 *                 default: true
 *     responses:
 *       201:
 *         description: Service ajouté avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Non autorisé à ajouter un service à ce pressing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'Non autorisé à ajouter un service à ce pressing'
 *       404:
 *         description: Aucun pressing trouvé avec cet ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Aucun pressing trouvé avec l'ID 5d713995b721c3bb38c1f5d0"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const addPressingService = async (req, res, next) => {
  try {
    console.log('🆕 Ajout d\'un service pour le pressing:', req.user._id);
    console.log('📝 Données reçues:', req.body);
    
    const pressingId = req.user._id;
    const { name, description, price, category, duration, isAvailable = true } = req.body;
    
    // Validation des données requises
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Nom, description, prix et catégorie sont requis'
      });
    }
    
    // Créer le service
    const service = await Service.create({
      nom: name,
      description,
      prix: price,
      categorie: category,
      dureeMoyenne: duration || 24,
      disponible: isAvailable,
      pressing: pressingId,
      createdBy: req.user._id
    });
    
    // Transformer la réponse pour le frontend
    const transformedService = {
      id: service._id,
      name: service.nom,
      description: service.description,
      category: service.categorie,
      price: service.prix,
      duration: service.dureeMoyenne,
      isAvailable: service.disponible,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    };
    
    console.log('✅ Service créé avec succès:', transformedService);
    
    res.status(201).json({
      success: true,
      data: transformedService
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout du service:', error);
    next(error);
  }
};

/**
 * @swagger
 * /pressings/{id}/services/{serviceId}:
 *   put:
 *     summary: Mettre à jour un service d'un pressing
 *     description: Permet au propriétaire d'un pressing de modifier les détails d'un service existant
 *     tags: [Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing
 *         example: 5d713995b721c3bb38c1f5d0
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du service à mettre à jour
 *         example: 5d725a037b2923d8c1c8b456
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *                 description: Nouveau nom du service
 *                 example: 'Nettoyage à sec premium'
 *               description:
 *                 type: string
 *                 description: Nouvelle description du service
 *                 example: 'Service de nettoyage à sec haut de gamme avec produits écologiques'
 *               prix:
 *                 type: number
 *                 minimum: 0
 *                 description: Nouveau prix du service en FCFA
 *                 example: 4500
 *               dureeMoyenne:
 *                 type: number
 *                 description: 'Nouvelle durée moyenne en heures'
 *                 example: 48
 *               disponible:
 *                 type: boolean
 *                 description: Indique si le service est actuellement disponible
 *                 example: true
 *     responses:
 *       200:
 *         description: Service mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Non autorisé à modifier ce service
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'Non autorisé à modifier ce service'
 *       404:
 *         description: Service ou pressing non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     error:
 *                       type: string
 *                       example: "Aucun pressing trouvé avec l'ID 5d713995b721c3bb38c1f5d0"
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     error:
 *                       type: string
 *                       example: "Aucun service trouvé avec l'ID 5d725a037b2923d8c1c8b456"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updatePressingService = async (req, res, next) => {
  try {
    console.log('🔄 Mise à jour du service:', req.params.serviceId);
    console.log('📝 Données reçues:', req.body);
    
    const pressingId = req.user._id;
    const { serviceId } = req.params;
    const { name, description, price, category, duration, isAvailable } = req.body;
    
    // Vérifier que le service appartient au pressing connecté
    const service = await Service.findOne({ _id: serviceId, pressing: pressingId });
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service non trouvé ou non autorisé'
      });
    }
    
    // Mettre à jour les champs fournis
    const updateData = {};
    if (name !== undefined) updateData.nom = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.prix = price;
    if (category !== undefined) updateData.categorie = category;
    if (duration !== undefined) updateData.dureeMoyenne = duration;
    if (isAvailable !== undefined) updateData.disponible = isAvailable;
    updateData.updatedBy = req.user._id;
    
    const updatedService = await Service.findByIdAndUpdate(
      serviceId,
      updateData,
      { new: true, runValidators: true }
    );
    
    // Transformer la réponse pour le frontend
    const transformedService = {
      id: updatedService._id,
      name: updatedService.nom,
      description: updatedService.description,
      category: updatedService.categorie,
      price: updatedService.prix,
      duration: updatedService.dureeMoyenne,
      isAvailable: updatedService.disponible,
      createdAt: updatedService.createdAt,
      updatedAt: updatedService.updatedAt
    };
    
    console.log('✅ Service mis à jour avec succès:', transformedService);
    
    res.status(200).json({
      success: true,
      data: transformedService
    });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du service:', error);
    next(error);
  }
};

/**
 * @swagger
 * /pressings/{id}/services/{serviceId}:
 *   delete:
 *     summary: Supprimer un service d'un pressing
 *     description: Permet au propriétaire d'un pressing de supprimer définitivement un service de son catalogue
 *     tags: [Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing
 *         example: 5d713995b721c3bb38c1f5d0
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du service à supprimer
 *         example: 5d725a037b2923d8c1c8b456
 *     responses:
 *       200:
 *         description: Service supprimé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   example: {}
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Non autorisé à supprimer ce service
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'Non autorisé à supprimer ce service'
 *       404:
 *         description: Service ou pressing non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     error:
 *                       type: string
 *                       example: "Aucun pressing trouvé avec l'ID 5d713995b721c3bb38c1f5d0"
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     error:
 *                       type: string
 *                       example: "Aucun service trouvé avec l'ID 5d725a037b2923d8c1c8b456"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deletePressingService = async (req, res, next) => {
  try {
    console.log('🗑️ Suppression du service:', req.params.serviceId);
    
    const pressingId = req.user._id;
    const { serviceId } = req.params;
    
    // Vérifier que le service appartient au pressing connecté
    const service = await Service.findOne({ _id: serviceId, pressing: pressingId });
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service non trouvé ou non autorisé'
      });
    }
    
    // Supprimer le service
    await Service.findByIdAndDelete(serviceId);
    
    console.log('✅ Service supprimé avec succès');
    
    res.status(200).json({
      success: true,
      message: 'Service supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du service:', error);
    next(error);
  }
};

// @desc    Récupérer les pressings à proximité avec géolocalisation
// @route   GET /api/v1/pressings/nearby
// @access  Public
const getPressingsNearby = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude et longitude requises'
      });
    }
    
    // Utiliser la méthode statique findNearby du modèle
    const pressings = await Pressing.findNearby(lng, lat, radius);
    
    // Les distances sont déjà calculées par $geoNear
    const pressingsWithDistance = pressings.map(pressing => {
      return {
        ...pressing,
        distance: pressing.distance ? Math.round(pressing.distance / 1000 * 100) / 100 : null // Convertir de mètres en km
      };
    });
    
    res.status(200).json({
      success: true,
      count: pressingsWithDistance.length,
      data: pressingsWithDistance
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Recherche avancée de pressings
// @route   GET /api/v1/pressings/search
// @access  Public
const searchPressings = async (req, res, next) => {
  try {
    const {
      q, // terme de recherche
      neighborhood, // quartier
      services, // services recherchés
      priceRange, // fourchette de prix
      rating, // note minimale
      openNow, // ouvert maintenant
      page = 1,
      limit = 10
    } = req.query;
    
    let query = {};
    
    // Recherche textuelle
    if (q) {
      query.$text = { $search: q };
    }
    
    // Filtrer par quartier
    if (neighborhood) {
      query['address.district'] = new RegExp(neighborhood, 'i');
    }
    
    // Filtrer par services
    if (services) {
      const serviceArray = services.split(',');
      query['services.category'] = { $in: serviceArray };
    }
    
    // Filtrer par note
    if (rating) {
      query['rating.average'] = { $gte: parseFloat(rating) };
    }
    
    // Filtrer par statut (actif et vérifié)
    query.isActive = true;
    query.isVerified = true;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'owner', select: 'nom prenom' },
        { path: 'services', select: 'name price category' }
      ],
      sort: q ? { score: { $meta: 'textScore' } } : { 'rating.average': -1 }
    };
    
    const result = await Pressing.paginate(query, options);
    
    res.status(200).json({
      success: true,
      count: result.docs.length,
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs
      },
      data: result.docs
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Ajouter un avis à un pressing
// @route   POST /api/v1/pressings/:id/reviews
// @access  Privé (Client)
const addPressingReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Note requise entre 1 et 5'
      });
    }
    
    const pressing = await Pressing.findById(req.params.id);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }
    
    // Vérifier si l'utilisateur a déjà laissé un avis
    const existingReview = pressing.reviews.find(
      review => review.userId.toString() === req.user._id.toString()
    );
    
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà laissé un avis pour ce pressing'
      });
    }
    
    // Ajouter le nouvel avis
    const newReview = {
      userId: req.user._id,
      rating,
      comment,
      createdAt: new Date()
    };
    
    pressing.reviews.push(newReview);
    
    // Mettre à jour la note moyenne
    await pressing.updateRating();
    
    res.status(201).json({
      success: true,
      data: newReview
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Récupérer les créneaux disponibles d'un pressing
// @route   GET /api/v1/pressings/:id/availability
// @access  Public
const getPressingAvailability = async (req, res, next) => {
  try {
    const { date } = req.query;
    
    const pressing = await Pressing.findById(req.params.id);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }
    
    // Si une date spécifique est demandée
    if (date) {
      const requestedDate = new Date(date);
      const dayOfWeek = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][requestedDate.getDay()];
      
      // Trouver les horaires pour ce jour
      const daySchedule = pressing.businessHours.find(schedule => schedule.day === dayOfWeek);
      
      if (!daySchedule || daySchedule.isClosed) {
        return res.status(200).json({
          success: true,
          data: {
            date,
            available: false,
            reason: 'Fermé ce jour-là'
          }
        });
      }
      
      // Générer les créneaux disponibles (par exemple, toutes les heures)
      const timeSlots = [];
      const [openHour, openMinute] = daySchedule.open.split(':').map(Number);
      const [closeHour, closeMinute] = daySchedule.close.split(':').map(Number);
      
      for (let hour = openHour; hour < closeHour; hour++) {
        timeSlots.push({
          time: `${hour.toString().padStart(2, '0')}:00`,
          available: true // TODO: vérifier les réservations existantes
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          date,
          available: true,
          timeSlots
        }
      });
    }
    
    // Retourner les horaires généraux
    res.status(200).json({
      success: true,
      data: {
        businessHours: pressing.businessHours,
        isOpen: pressing.isOpen()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Récupérer les statistiques d'un pressing (OPTIMISÉ)
 * @route   GET /api/v1/pressing/stats
 * @access  Privé (Pressing)
 */
const getPressingStats = async (req, res, next) => {
  try {
    const pressingId = req.user.id;
    console.log('📊 [OPTIMIZED] Récupération des statistiques pour le pressing:', pressingId);
    
    // DEBUG: Afficher toutes les informations de l'utilisateur connecté
    console.log('🔍 [DEBUG] Informations utilisateur connecté:');
    console.log('  - ID:', req.user._id || req.user.id);
    console.log('  - Email:', req.user.email);
    console.log('  - Role:', req.user.role, '(type:', typeof req.user.role, ')');
    console.log('  - Type:', req.user.type);
    console.log('  - Constructor:', req.user.constructor?.modelName);
    console.log('  - Objet complet:', JSON.stringify(req.user, null, 2));

    // Vérifier que l'utilisateur est bien un pressing
    // Le rôle est maintenant normalisé en minuscules par le middleware d'authentification
    const userRole = (req.user.role || '').toLowerCase();
    if (userRole !== 'pressing') {
      console.log('❌ Accès refusé - Rôle utilisateur:', req.user.role, '→ normalisé:', userRole);
      console.log('❌ Comparaison: "' + userRole + '" !== "pressing"');
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les pressings peuvent accéder à ces statistiques.',
        debug: {
          originalRole: req.user.role,
          normalizedRole: userRole,
          expectedRole: 'pressing',
          roleType: typeof req.user.role
        }
      });
    }
    
    console.log('✅ Autorisation accordée - Rôle:', req.user.role, '→ normalisé:', userRole);

    // Dates pour les calculs
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const lastWeekStart = new Date(startOfWeek);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastMonth = new Date(startOfMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Import du modèle Order
    const Order = require('../models/order.model');

    // OPTIMISATION: Une seule requête d'agrégation pour toutes les statistiques
    const statsResult = await Order.aggregate([
      {
        $match: {
          pressing: new mongoose.Types.ObjectId(pressingId)
        }
      },
      {
        $facet: {
          // Commandes d'aujourd'hui
          todayOrders: [
            { $match: { createdAt: { $gte: startOfToday } } },
            { $count: "count" }
          ],
          // Commandes terminées aujourd'hui
          completedToday: [
            { 
              $match: { 
                status: 'livree',
                updatedAt: { $gte: startOfToday }
              }
            },
            { $count: "count" }
          ],
          // Commandes en attente
          pendingOrders: [
            { 
              $match: { 
                status: { $in: ['en_attente', 'confirmee', 'en_cours', 'prete'] }
              }
            },
            { $count: "count" }
          ],
          // Revenus mensuels
          monthlyRevenue: [
            {
              $match: {
                status: 'livree',
                createdAt: { $gte: startOfMonth }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$totalAmount' }
              }
            }
          ],
          // Clients actifs ce mois
          activeCustomers: [
            {
              $match: {
                createdAt: { $gte: startOfMonth }
              }
            },
            {
              $group: {
                _id: '$customer'
              }
            },
            { $count: "count" }
          ],
          // Commandes cette semaine
          thisWeekOrders: [
            { $match: { createdAt: { $gte: startOfWeek } } },
            { $count: "count" }
          ],
          // Commandes semaine dernière
          lastWeekOrders: [
            { 
              $match: { 
                createdAt: { 
                  $gte: lastWeekStart, 
                  $lt: startOfWeek 
                }
              }
            },
            { $count: "count" }
          ],
          // Commandes ce mois
          thisMonthOrders: [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $count: "count" }
          ],
          // Commandes mois dernier
          lastMonthOrders: [
            { 
              $match: { 
                createdAt: { 
                  $gte: lastMonth, 
                  $lt: startOfMonth 
                }
              }
            },
            { $count: "count" }
          ]
        }
      }
    ]);

    // Récupérer les informations du pressing (en parallèle)
    const pressing = await Pressing.findById(pressingId).select('rating').lean();
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Extraire les résultats de l'agrégation
    const result = statsResult[0];
    const todayOrders = result.todayOrders[0]?.count || 0;
    const completedToday = result.completedToday[0]?.count || 0;
    const pendingOrders = result.pendingOrders[0]?.count || 0;
    const monthlyRevenue = result.monthlyRevenue[0]?.total || 0;
    const activeCustomers = result.activeCustomers[0]?.count || 0;
    const thisWeekOrders = result.thisWeekOrders[0]?.count || 0;
    const lastWeekOrders = result.lastWeekOrders[0]?.count || 0;
    const thisMonthOrders = result.thisMonthOrders[0]?.count || 0;
    const lastMonthOrders = result.lastMonthOrders[0]?.count || 0;

    // Calculs de croissance
    const weeklyGrowth = lastWeekOrders > 0 
      ? ((thisWeekOrders - lastWeekOrders) / lastWeekOrders * 100)
      : (thisWeekOrders > 0 ? 100 : 0);

    const monthlyGrowth = lastMonthOrders > 0 
      ? ((thisMonthOrders - lastMonthOrders) / lastMonthOrders * 100)
      : (thisMonthOrders > 0 ? 100 : 0);

    // Construire la réponse optimisée
    const stats = {
      todayOrders,
      monthlyRevenue,
      activeCustomers,
      avgRating: Math.round((pressing.rating || 0) * 10) / 10,
      pendingOrders,
      completedToday,
      weeklyGrowth: Math.round(weeklyGrowth * 10) / 10,
      monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
      // Métadonnées de performance
      _performance: {
        optimized: true,
        queriesReduced: '9 → 2',
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ [OPTIMIZED] Statistiques calculées en 2 requêtes:', stats);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Erreur lors du calcul des statistiques optimisées:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du calcul des statistiques',
      error: error.message
    });
  }
};

// @desc    Récupérer le profil du pressing connecté
// @route   GET /api/v1/pressing/profile
// @access  Privé (Pressing)
const getPressingProfile = async (req, res, next) => {
  try {
    console.log('🔍 [PROFILE] getPressingProfile function called!');
    console.log('🔍 [PROFILE] Request path:', req.path);
    console.log('🔍 [PROFILE] Original URL:', req.originalUrl);
    console.log('🔍 [DEBUG] req.user object:', JSON.stringify(req.user, null, 2));
    console.log('🔍 [DEBUG] req.user._id:', req.user._id);
    console.log('🔍 [DEBUG] req.user.id:', req.user.id);
    
    // Use req.user.id if _id is undefined
    const userId = req.user._id || req.user.id;
    console.log('🔍 Récupération profil pressing pour ID:', userId);
    
    const pressing = await Pressing.findById(userId)
      .select('-password -__v');

    if (!pressing) {
      console.log('❌ Pressing non trouvé avec ID:', userId);
      throw new NotFoundError(`Pressing non trouvé avec l'ID ${userId}`);
    }

    console.log('✅ Profil pressing récupéré:', {
      id: pressing._id,
      businessName: pressing.businessName,
      email: pressing.email
    });

    res.json({
      success: true,
      data: pressing,
    });
  } catch (err) {
    console.error('❌ Erreur lors de la récupération du profil pressing:', err);
    next(err);
  }
};

// @desc    Mettre à jour le profil du pressing connecté
// @route   PUT /api/v1/pressing/profile
// @access  Privé (Pressing)
const updatePressingProfile = async (req, res, next) => {
  try {
    console.log('🔄 Mise à jour profil pressing pour ID:', req.user._id);
    console.log('📝 Données reçues:', JSON.stringify(req.body, null, 2));
    
    const pressing = await Pressing.findById(req.user._id);

    if (!pressing) {
      console.log('❌ Pressing non trouvé avec ID:', req.user._id);
      throw new NotFoundError(`Pressing non trouvé avec l'ID ${req.user._id}`);
    }

    // Traitement spécial pour les coordonnées
    if (req.body.address && req.body.address.coordinates) {
      const coords = req.body.address.coordinates;
      
      // Si les coordonnées sont au format {lat, lng}, les convertir en format GeoJSON
      if (coords.lat !== undefined && coords.lng !== undefined) {
        req.body.address.coordinates = {
          type: 'Point',
          coordinates: [parseFloat(coords.lng), parseFloat(coords.lat)] // [longitude, latitude]
        };
        console.log('🗺️ Coordonnées converties en GeoJSON:', req.body.address.coordinates);
      }
      // Si les coordonnées sont déjà un tableau [lng, lat]
      else if (Array.isArray(coords) && coords.length === 2) {
        req.body.address.coordinates = {
          type: 'Point',
          coordinates: [parseFloat(coords[0]), parseFloat(coords[1])]
        };
        console.log('🗺️ Coordonnées tableau converties en GeoJSON:', req.body.address.coordinates);
      }
    }

    // Mettre à jour seulement les champs fournis
    const allowedUpdates = [
      'businessName', 'description', 'phone', 'address', 'businessHours',
      'services', 'deliveryOptions', 'photos'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        pressing[field] = req.body[field];
      }
    });

    const updatedPressing = await pressing.save();

    console.log('✅ Profil pressing mis à jour:', {
      id: updatedPressing._id,
      businessName: updatedPressing.businessName
    });

    // Transformer les données pour le frontend
    const transformedPressing = {
      id: updatedPressing._id,
      businessName: updatedPressing.businessName,
      description: updatedPressing.description,
      phone: updatedPressing.phone,
      email: updatedPressing.email,
      website: updatedPressing.website,
      address: {
        street: updatedPressing.address?.street || '',
        city: updatedPressing.address?.city || '',
        district: updatedPressing.address?.district || '',
        postalCode: updatedPressing.address?.postalCode || '',
        country: updatedPressing.address?.country || '',
        details: updatedPressing.address?.details || '',
        coordinates: updatedPressing.address?.coordinates?.coordinates ? {
          lat: updatedPressing.address.coordinates.coordinates[1],
          lng: updatedPressing.address.coordinates.coordinates[0]
        } : null
      },
      businessHours: updatedPressing.businessHours || [],
      services: updatedPressing.services || [],
      deliveryOptions: updatedPressing.deliveryOptions || {},
      photos: updatedPressing.photos || [],
      socialMedia: updatedPressing.socialMedia || {},
      rating: updatedPressing.rating || { average: 0, count: 0 },
      subscription: updatedPressing.subscription || {},
      isActive: updatedPressing.isActive,
      isVerified: updatedPressing.isVerified,
      createdAt: updatedPressing.createdAt,
      updatedAt: updatedPressing.updatedAt
    };

    res.json({
      success: true,
      data: transformedPressing,
    });
  } catch (err) {
    console.error('❌ Erreur lors de la mise à jour du profil pressing:', err);
    
    // Gestion spécifique des erreurs de validation
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({
        success: false,
        message: 'Données de validation invalides',
        errors
      });
    }
    
    next(err);
  }
};

// @desc    Récupérer les services d'un pressing
// @route   GET /api/v1/pressing/services
// @access  Privé (Pressing)
const getPressingServices = async (req, res, next) => {
  try {
    console.log('🔍 Récupération des services pour le pressing:', req.user._id);
    
    const pressingId = req.user._id;
    const { page = 1, limit = 50 } = req.query;
    
    // Récupérer les services du pressing connecté
    const services = await Service.find({ pressing: pressingId })
      .sort({ nom: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    // Compter le total des services
    const total = await Service.countDocuments({ pressing: pressingId });
    
    // Transformer les données pour correspondre au format frontend
    const transformedServices = services.map(service => ({
      id: service._id,
      name: service.nom,
      description: service.description,
      category: service.categorie,
      price: service.prix,
      duration: service.dureeMoyenne,
      isAvailable: service.disponible,
      options: service.options || [],
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    }));
    
    console.log(`✅ ${transformedServices.length} services trouvés pour le pressing ${pressingId}`);
    
    res.status(200).json({
      success: true,
      count: transformedServices.length,
      total,
      data: transformedServices
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des services:', error);
    next(error);
  }
};

// @desc    Récupérer les services d'un pressing par son ID public
// @route   GET /api/v1/pressings/:id/services
// @access  Public
const getPressingServicesByPublicId = async (req, res, next) => {
  try {
    const pressingId = req.params.id;
    console.log('🔍 Récupération des services pour le pressing public:', pressingId);
    
    const { page = 1, limit = 50 } = req.query;
    
    // Vérifier que le pressing existe
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        error: `Aucun pressing trouvé avec l'ID ${pressingId}`
      });
    }
    
    // Récupérer les services du pressing
    const services = await Service.find({ pressing: pressingId })
      .sort({ nom: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    // Compter le total des services
    const total = await Service.countDocuments({ pressing: pressingId });
    
    // Transformer les données pour correspondre au format frontend
    const transformedServices = services.map(service => ({
      id: service._id,
      name: service.nom,
      description: service.description,
      category: service.categorie,
      price: service.prix,
      duration: service.dureeMoyenne,
      isAvailable: service.disponible,
      options: service.options || [],
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    }));
    
    console.log(`✅ ${transformedServices.length} services trouvés pour le pressing ${pressingId}`);
    
    res.status(200).json({
      success: true,
      count: transformedServices.length,
      total,
      data: transformedServices
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des services:', error);
    next(error);
  }
};

// @desc    Récupérer les avis d'un pressing
// @route   GET /api/v1/pressing/reviews
// @access  Privé (Pressing)
const getPressingReviews = async (req, res, next) => {
  try {
    // Vérifier si req.user existe (authentifié) ou utiliser le paramètre de route
    const pressingId = req.user?._id || req.params.id;
    console.log('🔍 Récupération des avis pour le pressing:', pressingId);
    
    if (!pressingId) {
      return res.status(400).json({
        success: false,
        message: 'ID du pressing requis'
      });
    }
    const { page = 1, limit = 50 } = req.query;
    
    // Récupérer les avis du pressing connecté
    const reviews = await Review.find({ pressing: pressingId })
      .populate('customer', 'nom prenom email')
      .populate('order', '_id orderNumber')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    // Compter le total des avis
    const total = await Review.countDocuments({ pressing: pressingId });
    
    // Transformer les données pour correspondre au format frontend
    const transformedReviews = reviews.map(review => ({
      id: review._id,
      _id: review._id,
      customerName: review.customer ? `${review.customer.prenom || ''} ${review.customer.nom || ''}`.trim() : 'Client anonyme',
      rating: review.rating,
      comment: review.comment || '',
      createdAt: review.createdAt,
      orderId: review.order?._id || null,
      orderNumber: review.order?.orderNumber || null,
      response: review.ownerReply?.text ? {
        message: review.ownerReply.text,
        createdAt: review.ownerReply.repliedAt || review.updatedAt
      } : null,
      status: review.status || 'approved',
      photos: review.photos || [],
      customer: review.customer ? {
        nom: review.customer.nom || '',
        prenom: review.customer.prenom || '',
        email: review.customer.email || ''
      } : null,
      order: review.order ? {
        _id: review.order._id,
        orderNumber: review.order.orderNumber
      } : null
    }));
    
    console.log(`✅ ${transformedReviews.length} avis trouvés pour le pressing ${pressingId}`);
    
    res.status(200).json({
      success: true,
      count: transformedReviews.length,
      total,
      data: {
        reviews: transformedReviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des avis:', error);
    next(error);
  }
};

// @desc    Récupérer les données de revenus d'un pressing
// @route   GET /api/v1/pressing/earnings
// @access  Privé (Pressing)
const getPressingEarnings = async (req, res, next) => {
  try {
    console.log('🔍 Récupération des données de revenus pour le pressing:', req.user._id);
    
    const { period = 'daily', startDate, endDate } = req.query;
    const pressingId = req.user._id;
    
    // Import des modèles nécessaires
    const Order = require('../models/order.model');
    
    // Définir les dates par défaut si non fournies
    const now = new Date();
    let start, end;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Dates par défaut selon la période
      switch (period) {
        case 'daily':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
          end = now;
          break;
        case 'weekly':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 84); // 12 semaines
          end = now;
          break;
        case 'monthly':
          start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          end = now;
          break;
        default:
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
          end = now;
      }
    }
    
    console.log('📅 Période de recherche:', { period, start, end });
    
    // Requête pour récupérer les commandes du pressing dans la période
    const orders = await Order.find({
      pressing: pressingId,
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['livree', 'terminee', 'completed'] } // Commandes terminées uniquement
    }).populate('items.service', 'name category');
    
    console.log('📦 Commandes trouvées:', orders.length);
    
    // Calculer les statistiques générales
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Grouper les données par période
    const dailyData = [];
    const weeklyData = [];
    const monthlyData = [];
    
    // Données journalières
    const dailyGroups = {};
    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!dailyGroups[date]) {
        dailyGroups[date] = { totalRevenue: 0, totalOrders: 0 };
      }
      dailyGroups[date].totalRevenue += order.totalAmount || 0;
      dailyGroups[date].totalOrders += 1;
    });
    
    Object.entries(dailyGroups).forEach(([date, data]) => {
      dailyData.push({
        date,
        totalRevenue: data.totalRevenue,
        totalOrders: data.totalOrders
      });
    });
    
    // Données hebdomadaires (simplifiées)
    const weeklyGroups = {};
    orders.forEach(order => {
      const weekStart = new Date(order.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = { totalRevenue: 0, totalOrders: 0 };
      }
      weeklyGroups[weekKey].totalRevenue += order.totalAmount || 0;
      weeklyGroups[weekKey].totalOrders += 1;
    });
    
    Object.entries(weeklyGroups).forEach(([date, data]) => {
      weeklyData.push({
        date,
        totalRevenue: data.totalRevenue,
        totalOrders: data.totalOrders
      });
    });
    
    // Données mensuelles
    const monthlyGroups = {};
    orders.forEach(order => {
      const monthKey = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = { totalRevenue: 0, totalOrders: 0 };
      }
      monthlyGroups[monthKey].totalRevenue += order.totalAmount || 0;
      monthlyGroups[monthKey].totalOrders += 1;
    });
    
    Object.entries(monthlyGroups).forEach(([date, data]) => {
      monthlyData.push({
        date: date + '-01', // Format YYYY-MM-DD
        totalRevenue: data.totalRevenue,
        totalOrders: data.totalOrders
      });
    });
    
    // Analyse des méthodes de paiement
    const paymentMethodBreakdown = {
      mobile_money: 0,
      cash: 0,
      card: 0
    };
    
    orders.forEach(order => {
      if (order.payment && order.payment.method) {
        const method = order.payment.method.toLowerCase();
        if (method.includes('mobile') || method.includes('momo') || method.includes('orange') || method.includes('mtn')) {
          paymentMethodBreakdown.mobile_money += order.totalAmount || 0;
        } else if (method.includes('cash') || method.includes('espece')) {
          paymentMethodBreakdown.cash += order.totalAmount || 0;
        } else if (method.includes('card') || method.includes('carte')) {
          paymentMethodBreakdown.card += order.totalAmount || 0;
        }
      }
    });
    
    // Analyse des services
    const serviceBreakdown = [];
    const serviceGroups = {};
    
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const serviceName = item.service?.name || item.serviceName || 'Service inconnu';
          if (!serviceGroups[serviceName]) {
            serviceGroups[serviceName] = { totalRevenue: 0, totalOrders: 0 };
          }
          serviceGroups[serviceName].totalRevenue += (item.price * item.quantity) || 0;
          serviceGroups[serviceName].totalOrders += item.quantity || 1;
        });
      }
    });
    
    Object.entries(serviceGroups).forEach(([serviceName, data]) => {
      serviceBreakdown.push({
        serviceName,
        totalRevenue: data.totalRevenue,
        totalOrders: data.totalOrders
      });
    });
    
    // Top services (pour compatibilité avec l'interface existante)
    const topServices = serviceBreakdown
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5)
      .map(service => ({
        service: service.serviceName,
        revenue: service.totalRevenue,
        count: service.totalOrders
      }));
    
    const earningsData = {
      // Structure existante
      daily: dailyData.map(d => ({ date: d.date, revenue: d.totalRevenue, orders: d.totalOrders })),
      weekly: weeklyData.map(d => ({ week: d.date, revenue: d.totalRevenue, orders: d.totalOrders })),
      monthly: monthlyData.map(d => ({ month: d.date, revenue: d.totalRevenue, orders: d.totalOrders })),
      totalRevenue,
      totalOrders,
      averageOrderValue: Math.round(averageOrderValue),
      topServices,
      
      // Nouvelles propriétés pour compatibilité avec EarningsPage
      dailyEarnings: dailyData,
      weeklyEarnings: weeklyData,
      monthlyEarnings: monthlyData,
      paymentMethodBreakdown,
      serviceBreakdown
    };
    
    console.log('✅ Données de revenus calculées:', {
      totalRevenue,
      totalOrders,
      dailyDataPoints: dailyData.length,
      weeklyDataPoints: weeklyData.length,
      monthlyDataPoints: monthlyData.length,
      servicesCount: serviceBreakdown.length
    });
    
    res.status(200).json({
      success: true,
      data: earningsData
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des revenus:', error);
    next(error);
  }
};

// @desc    Géocodage inverse pour obtenir une adresse depuis des coordonnées
// @route   POST /api/v1/pressing/reverse-geocode
// @access  Privé (Pressing)
const reverseGeocode = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude et longitude requises'
      });
    }
    
    console.log(`🗺️ Géocodage inverse pour: ${lat}, ${lng}`);
    
    // Utiliser l'API Nominatim depuis le backend (pas de problème CORS)
    const fetch = require('node-fetch');
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`,
      {
        headers: {
          'User-Agent': 'GeopressCi-Backend/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Erreur API Nominatim: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extraire les composants de l'adresse
    const address = data.address || {};
    const result = {
      displayName: data.display_name || '',
      street: address.road || address.pedestrian || address.residential || '',
      district: address.suburb || address.neighbourhood || address.city_district || address.quarter || '',
      city: address.city || address.town || address.village || 'Abidjan',
      country: address.country || 'Côte d\'Ivoire',
      postalCode: address.postcode || '',
      coordinates: {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      }
    };
    
    console.log('✅ Géocodage inverse réussi:', result.displayName);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Erreur géocodage inverse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du géocodage inverse',
      error: error.message
    });
  }
};

// @desc    Récupérer les zones de livraison d'un pressing
// @route   GET /api/v1/pressing/delivery-zones
// @access  Privé (Pressing)
const getDeliveryZones = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { activeOnly = 'true' } = req.query;
    
    console.log('🚚 Récupération zones de livraison pour pressing:', pressingId);
    
    const zones = await DeliveryZone.findByPressing(
      pressingId, 
      activeOnly === 'true'
    );
    
    console.log(`✅ ${zones.length} zones trouvées`);
    
    res.status(200).json({
      success: true,
      count: zones.length,
      data: zones
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des zones:', error);
    next(error);
  }
};

// @desc    Créer une nouvelle zone de livraison
// @route   POST /api/v1/pressing/delivery-zones
// @access  Privé (Pressing)
const createDeliveryZone = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { name, deliveryFee, minOrder, estimatedDeliveryTime, description } = req.body;
    
    console.log('🚚 Création nouvelle zone:', { name, deliveryFee, minOrder });
    
    // Validation des données requises
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Le nom de la zone est requis'
      });
    }
    
    if (deliveryFee === undefined || deliveryFee < 0) {
      return res.status(400).json({
        success: false,
        message: 'Les frais de livraison doivent être spécifiés et positifs'
      });
    }
    
    if (minOrder === undefined || minOrder < 0) {
      return res.status(400).json({
        success: false,
        message: 'Le montant minimum doit être spécifié et positif'
      });
    }
    
    // Vérifier si une zone avec ce nom existe déjà
    const existingZone = await DeliveryZone.findOne({
      pressing: pressingId,
      name: name.trim()
    });
    
    if (existingZone) {
      return res.status(400).json({
        success: false,
        message: 'Une zone avec ce nom existe déjà'
      });
    }
    
    const zone = await DeliveryZone.create({
      pressing: pressingId,
      name: name.trim(),
      deliveryFee: Number(deliveryFee),
      minOrder: Number(minOrder),
      estimatedDeliveryTime: estimatedDeliveryTime || 45,
      description: description?.trim() || ''
    });
    
    console.log('✅ Zone créée:', zone._id);
    
    res.status(201).json({
      success: true,
      data: zone
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la création de la zone:', error);
    
    // Gestion des erreurs de validation MongoDB
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    // Gestion des erreurs de duplication
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Une zone avec ce nom existe déjà'
      });
    }
    
    next(error);
  }
};

// @desc    Mettre à jour une zone de livraison
// @route   PUT /api/v1/pressing/delivery-zones/:id
// @access  Privé (Pressing)
const updateDeliveryZone = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const zoneId = req.params.id;
    const { name, deliveryFee, minOrder, estimatedDeliveryTime, description, isActive } = req.body;
    
    console.log('🚚 Mise à jour zone:', zoneId, req.body);
    
    // Vérifier que la zone appartient au pressing
    const zone = await DeliveryZone.findOne({
      _id: zoneId,
      pressing: pressingId
    });
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone de livraison non trouvée'
      });
    }
    
    // Vérifier les doublons si le nom change
    if (name && name.trim() !== zone.name) {
      const existingZone = await DeliveryZone.findOne({
        pressing: pressingId,
        name: name.trim(),
        _id: { $ne: zoneId }
      });
      
      if (existingZone) {
        return res.status(400).json({
          success: false,
          message: 'Une zone avec ce nom existe déjà'
        });
      }
    }
    
    // Mise à jour des champs
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (deliveryFee !== undefined) updateData.deliveryFee = Number(deliveryFee);
    if (minOrder !== undefined) updateData.minOrder = Number(minOrder);
    if (estimatedDeliveryTime !== undefined) updateData.estimatedDeliveryTime = Number(estimatedDeliveryTime);
    if (description !== undefined) updateData.description = description.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    
    const updatedZone = await DeliveryZone.findByIdAndUpdate(
      zoneId,
      updateData,
      { new: true, runValidators: true }
    );
    
    console.log('✅ Zone mise à jour:', updatedZone._id);
    
    res.status(200).json({
      success: true,
      data: updatedZone
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la zone:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Une zone avec ce nom existe déjà'
      });
    }
    
    next(error);
  }
};

// @desc    Supprimer une zone de livraison
// @route   DELETE /api/v1/pressing/delivery-zones/:id
// @access  Privé (Pressing)
const deleteDeliveryZone = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const zoneId = req.params.id;
    
    console.log('🚚 Suppression zone:', zoneId);
    
    // Vérifier que la zone appartient au pressing
    const zone = await DeliveryZone.findOne({
      _id: zoneId,
      pressing: pressingId
    });
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone de livraison non trouvée'
      });
    }
    
    await DeliveryZone.findByIdAndDelete(zoneId);
    
    console.log('✅ Zone supprimée:', zoneId);
    
    res.status(200).json({
      success: true,
      message: 'Zone de livraison supprimée avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la zone:', error);
    next(error);
  }
};

// @desc    Récupérer une zone de livraison spécifique
// @route   GET /api/v1/pressing/delivery-zones/:id
// @access  Privé (Pressing)
const getDeliveryZone = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const zoneId = req.params.id;
    
    console.log('🚚 Récupération zone:', zoneId);
    
    const zone = await DeliveryZone.findOne({
      _id: zoneId,
      pressing: pressingId
    });
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone de livraison non trouvée'
      });
    }
    
    console.log('✅ Zone trouvée:', zone._id);
    
    res.status(200).json({
      success: true,
      data: zone
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la zone:', error);
    next(error);
  }
};

// ===== GESTION DES PHOTOS =====

/**
 * @desc    Récupérer les photos d'un pressing
 * @route   GET /api/v1/pressing/photos
 * @access  Private (Pressing)
 */
const getPressingPhotos = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    
    console.log('📸 Récupération photos pressing:', pressingId);
    
    const pressing = await Pressing.findById(pressingId).select('photos');
    
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }
    
    res.status(200).json({
      success: true,
      count: pressing.photos.length,
      data: pressing.photos
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des photos:', error);
    next(error);
  }
};

/**
 * @desc    Ajouter une photo à un pressing
 * @route   POST /api/v1/pressing/photos
 * @access  Private (Pressing)
 */
const uploadPressingPhoto = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { url, caption, isPrimary = false } = req.body;
    
    console.log('📸 Upload photo pressing:', pressingId, { url, caption, isPrimary });
    
    // Validation
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL de la photo requise'
      });
    }
    
    const pressing = await Pressing.findById(pressingId);
    
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }
    
    // Si isPrimary est true, désactiver les autres photos primaires
    if (isPrimary) {
      pressing.photos.forEach(photo => {
        photo.isPrimary = false;
      });
    }
    
    // Ajouter la nouvelle photo
    const newPhoto = {
      url,
      caption: caption || '',
      isPrimary,
      uploadedAt: new Date()
    };
    
    pressing.photos.push(newPhoto);
    await pressing.save();
    
    // Récupérer la photo ajoutée avec son ID
    const addedPhoto = pressing.photos[pressing.photos.length - 1];
    
    console.log('✅ Photo ajoutée:', addedPhoto._id);
    
    res.status(201).json({
      success: true,
      message: 'Photo ajoutée avec succès',
      data: addedPhoto
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'upload de la photo:', error);
    next(error);
  }
};

/**
 * @desc    Mettre à jour une photo
 * @route   PUT /api/v1/pressing/photos/:photoId
 * @access  Private (Pressing)
 */
const updatePressingPhoto = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { photoId } = req.params;
    const { caption, isPrimary } = req.body;
    
    console.log('📸 Mise à jour photo:', photoId, { caption, isPrimary });
    
    const pressing = await Pressing.findById(pressingId);
    
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }
    
    const photo = pressing.photos.id(photoId);
    
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo non trouvée'
      });
    }
    
    // Si isPrimary est true, désactiver les autres photos primaires
    if (isPrimary) {
      pressing.photos.forEach(p => {
        if (p._id.toString() !== photoId) {
          p.isPrimary = false;
        }
      });
    }
    
    // Mettre à jour la photo
    if (caption !== undefined) photo.caption = caption;
    if (isPrimary !== undefined) photo.isPrimary = isPrimary;
    
    await pressing.save();
    
    console.log('✅ Photo mise à jour:', photoId);
    
    res.status(200).json({
      success: true,
      message: 'Photo mise à jour avec succès',
      data: photo
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la photo:', error);
    next(error);
  }
};

/**
 * @desc    Supprimer une photo
 * @route   DELETE /api/v1/pressing/photos/:photoId
 * @access  Private (Pressing)
 */
const deletePressingPhoto = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { photoId } = req.params;
    
    console.log('📸 Suppression photo:', photoId);
    
    const pressing = await Pressing.findById(pressingId);
    
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }
    
    const photo = pressing.photos.id(photoId);
    
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo non trouvée'
      });
    }
    
    // Empêcher la suppression de la photo primaire s'il n'y en a qu'une
    if (photo.isPrimary && pressing.photos.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer la seule photo primaire'
      });
    }
    
    // Supprimer la photo
    pressing.photos.pull(photoId);
    await pressing.save();
    
    console.log('✅ Photo supprimée:', photoId);
    
    res.status(200).json({
      success: true,
      message: 'Photo supprimée avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la photo:', error);
    next(error);
  }
};

/**
 * @desc    Upload d'un fichier photo
 * @route   POST /api/v1/pressing/photos/upload
 * @access  Private (Pressing)
 */
const uploadPhotoFile = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { caption, isPrimary = false } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }
    
    console.log('📸 Upload fichier photo:', {
      pressingId,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Pressing non trouvé' });
    }

    const { getFileUrl } = require('../middleware/upload.middleware');
    const fileUrl = getFileUrl(req, req.file.filename);

    const newPhoto = {
      url: fileUrl,
      caption: caption || '',
      isPrimary: isPrimary === 'true' || isPrimary === true,
      uploadedAt: new Date()
    };

    // Si c'est la première photo, on la marque comme principale
    if (pressing.photos.length === 0) {
      newPhoto.isPrimary = true;
    }

    // Si la nouvelle photo est marquée comme principale, on réinitialise les autres
    if (newPhoto.isPrimary) {
      pressing.photos.forEach(photo => { photo.isPrimary = false; });
    }

    // Ajouter la nouvelle photo au début du tableau
    pressing.photos.unshift(newPhoto);
    
    // S'assurer qu'on ne garde qu'une seule photo principale
    if (newPhoto.isPrimary && pressing.photos.length > 1) {
      // Trouver l'index de la nouvelle photo (qui est maintenant à l'index 0)
      // et s'assurer qu'aucune autre photo n'est marquée comme principale
      for (let i = 1; i < pressing.photos.length; i++) {
        if (pressing.photos[i].isPrimary) {
          pressing.photos[i].isPrimary = false;
        }
      }
    }

    await pressing.save();

    // La nouvelle photo est toujours à l'index 0 car on l'a ajoutée avec unshift
    const addedPhoto = pressing.photos[0];
    
    console.log('✅ Photo ajoutée avec succès:', addedPhoto._id);
    
    res.status(201).json({
      success: true,
      message: 'Photo téléchargée avec succès',
      data: addedPhoto
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'upload de la photo:', error);
    
    // Supprimer le fichier en cas d'erreur
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Erreur lors de la suppression du fichier:', unlinkErr);
      });
    }
    
    next(error);
  }
};



const setPressingPhotoRole = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { photoId, role } = req.body;

    if (!photoId || !['cover', 'logo'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Photo ID et rôle requis (cover ou logo)'
      });
    }

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Trouver la photo dans le tableau
    const photo = pressing.photos.find(p => p._id.toString() === photoId);
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo non trouvée'
      });
    }

    // Mettre à jour le rôle de la photo
    if (role === 'cover') {
      // Désactiver toutes les photos de couverture existantes
      pressing.photos.forEach(p => {
        if (p._id.toString() !== photoId) {
          p.isPrimary = false;
        }
      });
      photo.isPrimary = true;
    } else if (role === 'logo') {
      // Désactiver tous les logos existants
      pressing.photos.forEach(p => {
        if (p._id.toString() !== photoId) {
          p.isLogo = false;
        }
      });
      photo.isLogo = true;
    }

    await pressing.save();

    res.status(200).json({
      success: true,
      message: `Photo définie comme ${role}`,
      data: photo
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Activer/désactiver un service d'un pressing
// @route   PATCH /api/v1/pressings/services/:serviceId/toggle
// @access  Privé (Pressing)
const toggleServiceAvailability = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { serviceId } = req.params;

    // Vérifier que le serviceId est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return next(new ErrorResponse(`ID de service invalide: ${serviceId}`, 400));
    }

    // Trouver le pressing
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return next(new NotFoundError(`Aucun pressing trouvé avec l'ID ${pressingId}`));
    }

    // Trouver le service dans les services du pressing
    const serviceIndex = pressing.services.findIndex(
      service => service._id.toString() === serviceId
    );

    if (serviceIndex === -1) {
      return next(new NotFoundError(`Aucun service trouvé avec l'ID ${serviceId}`));
    }

    // Inverser la disponibilité du service
    pressing.services[serviceIndex].isAvailable = !pressing.services[serviceIndex].isAvailable;
    
    // Sauvegarder les modifications
    await pressing.save();

    res.status(200).json({
      success: true,
      data: pressing.services[serviceIndex],
      message: `Le service a été ${pressing.services[serviceIndex].isAvailable ? 'activé' : 'désactivé'}`
    });
  } catch (error) {
    next(error);
  }
};

// ===== PROMOTION MANAGEMENT =====

/**
 * Get all promotions for the authenticated pressing
 */
const getPressingPromotions = async (req, res, next) => {
  try {
    console.log('[DEBUG] getPressingPromotions - User:', req.user.id, 'Role:', req.user.role);
    
    const { page = 1, limit = 12, status, type } = req.query;
    const skip = (page - 1) * limit;
    
    // Build filter for this pressing only
    const filter = {
      createdBy: req.user.id,
      status: { $ne: 'deleted' }
    };
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (type && type !== 'all') {
      filter.type = type;
    }
    
    console.log('[DEBUG] Promotion filter:', filter);
    
    const promotions = await Promotion.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'businessName email')
      .lean();
    
    const total = await Promotion.countDocuments(filter);
    
    console.log('[DEBUG] Found promotions:', promotions.length, 'Total:', total);
    
    res.status(200).json({
      success: true,
      data: promotions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      count: promotions.length
    });
  } catch (error) {
    console.error('[ERROR] getPressingPromotions:', error);
    next(error);
  }
};

/**
 * Create a new promotion for the authenticated pressing
 */
const createPressingPromotion = async (req, res, next) => {
  try {
    console.log('[DEBUG] createPressingPromotion - User:', req.user.id);
    console.log('[DEBUG] Promotion data:', req.body);
    
    // Filter promotion data based on type to avoid validation errors
    const { type } = req.body;
    const promotionData = {
      ...req.body,
      createdBy: req.user.id,
      target: {
        pressings: [req.user.id]
      }
    };
    
    // Remove fields that are not needed for this promotion type
    if (type !== 'free_trial') {
      delete promotionData.trialDays;
    }
    if (type !== 'buy_x_get_y') {
      delete promotionData.buyX;
      delete promotionData.getY;
    }
    if (type === 'free_trial') {
      delete promotionData.value;
    }
    
    const promotion = new Promotion(promotionData);
    await promotion.save();
    
    await promotion.populate('createdBy', 'businessName email');
    
    console.log('[DEBUG] Promotion created:', promotion._id);
    
    res.status(201).json({
      success: true,
      data: promotion,
      message: 'Promotion créée avec succès'
    });
  } catch (error) {
    console.error('[ERROR] createPressingPromotion:', error);
    next(error);
  }
};

/**
 * Get a specific promotion by ID (only if owned by pressing)
 */
const getPressingPromotionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('[DEBUG] getPressingPromotionById - ID:', id, 'User:', req.user.id);
    
    const promotion = await Promotion.findOne({
      _id: id,
      createdBy: req.user.id,
      status: { $ne: 'deleted' }
    }).populate('createdBy', 'businessName email');
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }
    
    console.log('[DEBUG] Promotion found:', promotion._id);
    
    res.status(200).json({
      success: true,
      data: promotion
    });
  } catch (error) {
    console.error('[ERROR] getPressingPromotionById:', error);
    next(error);
  }
};

/**
 * Update a promotion (only if owned by pressing)
 */
const updatePressingPromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('[DEBUG] updatePressingPromotion - ID:', id, 'User:', req.user.id);
    console.log('[DEBUG] Update data:', req.body);
    
    const promotion = await Promotion.findOneAndUpdate(
      {
        _id: id,
        createdBy: req.user.id,
        status: { $ne: 'deleted' }
      },
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'businessName email');
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée ou non autorisée'
      });
    }
    
    console.log('[DEBUG] Promotion updated:', promotion._id);
    
    res.status(200).json({
      success: true,
      data: promotion,
      message: 'Promotion mise à jour avec succès'
    });
  } catch (error) {
    console.error('[ERROR] updatePressingPromotion:', error);
    next(error);
  }
};

/**
 * Delete a promotion (soft delete - only if owned by pressing)
 */
const deletePressingPromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('[DEBUG] deletePressingPromotion - ID:', id, 'User:', req.user.id);
    
    const promotion = await Promotion.findOneAndUpdate(
      {
        _id: id,
        createdBy: req.user.id,
        status: { $ne: 'deleted' }
      },
      { status: 'deleted' },
      { new: true }
    );
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée ou non autorisée'
      });
    }
    
    console.log('[DEBUG] Promotion deleted:', promotion._id);
    
    res.status(200).json({
      success: true,
      message: 'Promotion supprimée avec succès'
    });
  } catch (error) {
    console.error('[ERROR] deletePressingPromotion:', error);
    next(error);
  }
};

/**
 * Update promotion status (only if owned by pressing)
 */
const updatePressingPromotionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    console.log('[DEBUG] updatePressingPromotionStatus - ID:', id, 'Status:', status, 'User:', req.user.id);
    
    if (!['draft', 'active', 'inactive', 'expired'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }
    
    const promotion = await Promotion.findOneAndUpdate(
      {
        _id: id,
        createdBy: req.user.id,
        status: { $ne: 'deleted' }
      },
      { status },
      { new: true }
    ).populate('createdBy', 'businessName email');
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée ou non autorisée'
      });
    }
    
    console.log('[DEBUG] Promotion status updated:', promotion._id, 'New status:', status);
    
    res.status(200).json({
      success: true,
      data: promotion,
      message: `Promotion ${status === 'active' ? 'activée' : status === 'inactive' ? 'désactivée' : 'mise à jour'} avec succès`
    });
  } catch (error) {
    console.error('[ERROR] updatePressingPromotionStatus:', error);
    next(error);
  }
};

// @desc    Get all public promotions from all pressings
// @route   GET /api/v1/pressings/promotions
// @access  Public
const getAllPublicPromotions = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, status = 'active', type } = req.query;
    const skip = (page - 1) * limit;
    
    // Build filter for active public promotions
    const filter = {
      status: { $ne: 'deleted' } // Always exclude deleted promotions
    };
    
    // Add status filter if not 'all'
    if (status !== 'all') {
      filter.status = status;
    } else {
      // For 'all', get active and inactive but not deleted
      filter.status = { $in: ['active', 'inactive'] };
    }
    
    if (type && type !== 'all') {
      filter.type = type;
    }
    
    console.log('[DEBUG] Public promotions filter:', filter);
    
    const Promotion = require('../models/promotion.model');
    
    const promotions = await Promotion.find(filter)
      .populate('createdBy', 'businessName email location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Promotion.countDocuments(filter);
    
    console.log(`[DEBUG] Found ${promotions.length} public promotions`);
    
    res.status(200).json({
      success: true,
      count: promotions.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      data: promotions
    });
  } catch (error) {
    console.error('[ERROR] getAllPublicPromotions:', error);
    next(error);
  }
};

module.exports = {
  getPressings,
  uploadPhotoFile,
  getPressing,
  getPressingProfile,
  updatePressingProfile, // ✅ AJOUTÉ - Fonction de mise à jour du profil
  getPressingAvailability,
  createPressing,
  updatePressing,
  deletePressing,
  getPressingsNearby,
  searchPressings,
  getPressingStats,
  getPressingReviews,
  addPressingReview,
  updatePressingService,
  deletePressingService,
  addPressingService,
  getPressingServices,
  getPressingServicesByPublicId,
  // Delivery zones
  getDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  getDeliveryZone,
  getPressingPhotos,
  uploadPressingPhoto,
  updatePressingPhoto,
  deletePressingPhoto,
  uploadPhotoFile,
  setPressingPhotoRole,
  toggleServiceAvailability,
  // Promotions
  getAllPublicPromotions,
  getPressingPromotions,
  createPressingPromotion,
  getPressingPromotionById,
  updatePressingPromotion,
  deletePressingPromotion,
  updatePressingPromotionStatus,
  // Earnings
  getPressingEarnings,
};

// ===== FONCTIONS UTILITAIRES POUR DONNÉES TEMPS RÉEL =====

/**
 * Calcule les statistiques en temps réel d'un pressing
 * @param {string} pressingId - ID du pressing
 * @returns {Object} Statistiques calculées
 */
async function calculatePressingStats(pressingId) {
  try {
    const [orderStats, reviewStats] = await Promise.all([
      // Statistiques des commandes
      Order.aggregate([
        { $match: { pressing: new mongoose.Types.ObjectId(pressingId) } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            pendingOrders: {
              $sum: { $cond: [{ $in: ['$status', ['pending', 'confirmed', 'in_progress']] }, 1, 0] }
            },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] }
            },
            lastOrderDate: { $max: '$createdAt' },
            lastOrderProcessed: {
              $max: { $cond: [{ $eq: ['$status', 'completed'] }, '$updatedAt', null] }
            }
          }
        }
      ]),
      
      // Statistiques des avis
      Review.aggregate([
        { $match: { pressing: new mongoose.Types.ObjectId(pressingId) } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            totalScore: { $sum: '$rating' }
          }
        }
      ])
    ]);

    const orderData = orderStats[0] || {};
    const reviewData = reviewStats[0] || {};

    // Calculs de métriques avancées
    const completionRate = orderData.totalOrders > 0 
      ? (orderData.completedOrders / orderData.totalOrders) * 100 
      : 0;
    
    const conversionRate = orderData.totalOrders > 0 
      ? (orderData.completedOrders / orderData.totalOrders) * 100 
      : 0;

    const customerSatisfaction = reviewData.averageRating 
      ? (reviewData.averageRating / 5) * 100 
      : 0;

    return {
      totalOrders: orderData.totalOrders || 0,
      completedOrders: orderData.completedOrders || 0,
      pendingOrders: orderData.pendingOrders || 0,
      totalRevenue: orderData.totalRevenue || 0,
      averageRating: reviewData.averageRating || 0,
      totalReviews: reviewData.totalReviews || 0,
      lastOrderDate: orderData.lastOrderDate,
      lastOrderProcessed: orderData.lastOrderProcessed,
      completionRate: Math.round(completionRate * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      customerSatisfaction: Math.round(customerSatisfaction * 100) / 100,
      averageResponseTime: 0, // À implémenter si nécessaire
      repeatCustomerRate: 0   // À implémenter si nécessaire
    };
  } catch (error) {
    console.error('❌ Erreur calculatePressingStats:', error);
    return {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      totalRevenue: 0,
      averageRating: 0,
      totalReviews: 0,
      completionRate: 0,
      conversionRate: 0,
      customerSatisfaction: 0,
      averageResponseTime: 0,
      repeatCustomerRate: 0
    };
  }
}

/**
 * Calcule la prochaine heure d'ouverture d'un pressing
 * @param {Array} businessHours - Horaires d'ouverture du pressing
 * @param {Date} currentTime - Heure actuelle
 * @returns {Object} Informations sur la prochaine ouverture
 */
function getNextOpeningTime(businessHours, currentTime) {
  const daysOfWeek = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const currentDay = currentTime.getDay();
  const currentTimeStr = currentTime.toTimeString().slice(0, 5);
  
  // Vérifier si ouvert aujourd'hui mais pas encore fermé
  const todayHours = businessHours.find(h => h.day === daysOfWeek[currentDay]);
  if (todayHours && !todayHours.isClosed && currentTimeStr < todayHours.close) {
    return {
      isOpenToday: true,
      nextOpeningDay: daysOfWeek[currentDay],
      nextOpeningTime: todayHours.open,
      hoursUntilOpen: 0
    };
  }
  
  // Chercher le prochain jour d'ouverture
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDay + i) % 7;
    const nextDayName = daysOfWeek[nextDayIndex];
    const nextDayHours = businessHours.find(h => h.day === nextDayName);
    
    if (nextDayHours && !nextDayHours.isClosed) {
      const nextOpeningDate = new Date(currentTime);
      nextOpeningDate.setDate(nextOpeningDate.getDate() + i);
      const [hours, minutes] = nextDayHours.open.split(':');
      nextOpeningDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const hoursUntilOpen = Math.ceil((nextOpeningDate - currentTime) / (1000 * 60 * 60));
      
      return {
        isOpenToday: false,
        nextOpeningDay: nextDayName,
        nextOpeningTime: nextDayHours.open,
        nextOpeningDate: nextOpeningDate.toISOString(),
        hoursUntilOpen
      };
    }
  }
  
  // Aucun jour d'ouverture trouvé (pressing fermé définitivement ?)
  return {
    isOpenToday: false,
    nextOpeningDay: null,
    nextOpeningTime: null,
    nextOpeningDate: null,
    hoursUntilOpen: null
  };
}
