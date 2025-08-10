const Pressing = require('../models/pressing.model');
const Service = require('../models/service.model');
const { ErrorResponse } = require('../utils/error.utils');

/**
 * @desc    Récupérer tous les services du pressing connecté
 * @route   GET /api/v1/pressing/services
 * @access  Privé (Pressing)
 */
const getMyServices = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    console.log('🔍 Récupération des services pour le pressing:', pressingId);
    console.log('🔍 Type de pressingId:', typeof pressingId, pressingId);
    
    // Récupérer les services depuis la collection Service séparée
    console.log('🔍 Recherche dans la collection Service...');
    const services = await Service.find({ pressing: pressingId }).sort({ createdAt: -1 });
    
    console.log('🔍 Services trouvés dans la collection Service:', {
      count: services.length,
      services: services.map(s => ({ id: s._id, nom: s.nom, categorie: s.categorie, prix: s.prix }))
    });

    console.log(`✅ ${services.length} services trouvés pour le pressing ${pressingId}`);

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Créer un nouveau service
 * @route   POST /api/v1/pressing/services
 * @access  Privé (Pressing)
 */
const createService = async (req, res, next) => {
  console.log('🚨🚨🚨 FONCTION createService APPELÉE 🚨🚨🚨');
  console.log('🚨🚨🚨 NOUVEAU CODE ACTIF 🚨🚨🚨');
  try {
    const pressingId = req.user._id;
    
    console.log('🆕 Ajout d\'un service pour le pressing:', pressingId);
    console.log('📝 Données reçues:', req.body);
    console.log('='.repeat(50));
    console.log('🔥 NOUVEAU CODE ACTIF - VERSION CORRIGÉE');
    console.log('='.repeat(50));
    
    // Extraire les données avec support des noms français et anglais
    const {
      name, nom,
      description,
      price, prix,
      category, categorie,
      duration, dureeMoyenne,
      isAvailable, disponible,
      minOrderQuantity,
      maxOrderQuantity,
      preparationTime
    } = req.body;
    
    // Mapping des catégories pour correspondre aux valeurs enum du modèle Service séparé
    // Enum du modèle Service: ['nettoyage', 'lavage', 'repassage', 'teinture', 'retouche', 'autre']
    const categoryMapping = {
      'nettoyage': 'nettoyage',     // Pas de conversion nécessaire
      'lavage': 'lavage',
      'repassage': 'repassage', 
      'teinture': 'teinture',
      'retouche': 'retouche',
      'autre': 'autre',
      // Support pour d'anciennes valeurs si nécessaire
      'nettoyage_sec': 'nettoyage'
    };
    
    // Utiliser les valeurs françaises en priorité, puis anglaises en fallback
    const serviceName = nom || name;
    const serviceDescription = description || '';
    const servicePrice = prix || price;
    const rawCategory = categorie || category;
    const serviceCategory = categoryMapping[rawCategory] || rawCategory; // Mapping automatique
    const serviceDuration = dureeMoyenne || duration;
    const serviceAvailable = disponible !== undefined ? disponible : (isAvailable !== undefined ? isAvailable : true);
    
    console.log('🔄 Mapping catégorie:', {
      categorieRecue: rawCategory,
      categorieFinale: serviceCategory
    });

    console.log('🔍 Données mappées:', {
      serviceName,
      serviceDescription,
      servicePrice,
      serviceCategory,
      serviceDuration,
      serviceAvailable
    });

    // Validation des champs requis avec logs détaillés
    console.log('🔍 Validation des champs:', {
      serviceName: serviceName ? 'OK' : 'MANQUANT',
      serviceDescription: serviceDescription ? 'OK' : 'MANQUANT', 
      servicePrice: servicePrice ? 'OK' : 'MANQUANT',
      serviceCategory: serviceCategory ? 'OK' : 'MANQUANT'
    });
    
    if (!serviceName || !servicePrice || !serviceCategory) {
      console.log('❌ Validation échouée - champs manquants');
      console.log('❌ Détails:', {
        serviceName,
        serviceDescription,
        servicePrice,
        serviceCategory
      });
      return res.status(400).json({
        success: false,
        message: 'Nom, prix et catégorie sont requis'
      });
    }
    
    console.log('✅ Validation réussie, création du service...');

    // Vérifier si le pressing existe
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Vérifier si un service avec le même nom existe déjà pour ce pressing
    const existingService = await Service.findOne({
      pressing: pressingId,
      nom: { $regex: new RegExp(`^${serviceName}$`, 'i') }
    });

    if (existingService) {
      return res.status(400).json({
        success: false,
        message: 'Un service avec ce nom existe déjà'
      });
    }

    // Créer le nouveau service dans la collection Service séparée
    const serviceData = {
      nom: serviceName.trim(),
      description: serviceDescription.trim(),
      prix: parseFloat(servicePrice),
      categorie: serviceCategory,
      dureeMoyenne: parseInt(serviceDuration) || 60, // Durée par défaut en minutes
      disponible: serviceAvailable,
      pressing: pressingId,
      createdBy: pressingId,
      validite: req.body.validite || 30,
      options: req.body.options || [],
      images: req.body.images || []
    };

    console.log('✅ Données du service à créer:', serviceData);

    console.log('💾 Création du service dans la collection Service...');
    const newService = await Service.create(serviceData);
    console.log('✅ Service créé avec succès dans la collection Service');
    console.log('🔍 Service créé:', newService);

    res.status(201).json({
      success: true,
      message: 'Service créé avec succès',
      data: newService
    });
  } catch (error) {
    console.log('❌ Erreur lors de la création du service:', error);
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map(val => val.message).join(', ');
      return res.status(400).json({
        success: false,
        message
      });
    }
    next(error);
  }
};

/**
 * @desc    Mettre à jour un service
 * @route   PUT /api/v1/pressing/services/:serviceId
 * @access  Privé (Pressing)
 */
const updateService = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { serviceId } = req.params;
    const updateData = req.body;
    
    console.log('🔄 Mise à jour d\'un service pour le pressing:', pressingId);
    console.log('📝 Données de mise à jour reçues:', updateData);

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Trouver le service à mettre à jour
    const serviceIndex = pressing.services.findIndex(service => 
      service._id.toString() === serviceId
    );

    if (serviceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Service non trouvé'
      });
    }

    // Mapper les champs français vers anglais pour la mise à jour
    const mappedUpdateData = {};
    
    // Mapping des champs avec priorité française
    if (updateData.nom || updateData.name) {
      mappedUpdateData.name = updateData.nom || updateData.name;
    }
    if (updateData.description !== undefined) {
      mappedUpdateData.description = updateData.description;
    }
    if (updateData.prix || updateData.price) {
      mappedUpdateData.price = updateData.prix || updateData.price;
    }
    if (updateData.categorie || updateData.category) {
      mappedUpdateData.category = updateData.categorie || updateData.category;
    }
    if (updateData.dureeMoyenne || updateData.duration) {
      mappedUpdateData.duration = updateData.dureeMoyenne || updateData.duration;
    }
    if (updateData.disponible !== undefined || updateData.isAvailable !== undefined) {
      mappedUpdateData.isAvailable = updateData.disponible !== undefined ? updateData.disponible : updateData.isAvailable;
    }
    if (updateData.minOrderQuantity !== undefined) {
      mappedUpdateData.minOrderQuantity = updateData.minOrderQuantity;
    }
    if (updateData.maxOrderQuantity !== undefined) {
      mappedUpdateData.maxOrderQuantity = updateData.maxOrderQuantity;
    }
    if (updateData.preparationTime !== undefined) {
      mappedUpdateData.preparationTime = updateData.preparationTime;
    }

    console.log('🔍 Données mappées pour mise à jour:', mappedUpdateData);

    // Vérifier si le nouveau nom existe déjà (si le nom est modifié)
    if (mappedUpdateData.name && mappedUpdateData.name !== pressing.services[serviceIndex].name) {
      const existingService = pressing.services.find((service, index) => 
        index !== serviceIndex && service.name.toLowerCase() === mappedUpdateData.name.toLowerCase()
      );

      if (existingService) {
        return res.status(400).json({
          success: false,
          message: 'Un service avec ce nom existe déjà'
        });
      }
    }

    // Mettre à jour les champs avec les données mappées
    const allowedFields = ['name', 'description', 'price', 'category', 'duration', 'isAvailable', 'minOrderQuantity', 'maxOrderQuantity', 'preparationTime'];
    
    allowedFields.forEach(field => {
      if (mappedUpdateData[field] !== undefined) {
        if (field === 'name' || field === 'description') {
          pressing.services[serviceIndex][field] = mappedUpdateData[field].toString().trim();
        } else if (field === 'price' || field === 'duration' || field === 'minOrderQuantity' || field === 'maxOrderQuantity' || field === 'preparationTime') {
          pressing.services[serviceIndex][field] = parseFloat(mappedUpdateData[field]) || parseInt(mappedUpdateData[field]);
        } else {
          pressing.services[serviceIndex][field] = mappedUpdateData[field];
        }
      }
    });

    await pressing.save();

    console.log('✅ Service mis à jour avec succès');

    res.status(200).json({
      success: true,
      message: 'Service mis à jour avec succès',
      data: pressing.services[serviceIndex]
    });
  } catch (error) {
    console.log('❌ Erreur lors de la mise à jour du service:', error);
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map(val => val.message).join(', ');
      return res.status(400).json({
        success: false,
        message
      });
    }
    next(error);
  }
};

/**
 * @desc    Supprimer un service
 * @route   DELETE /api/v1/pressing/services/:serviceId
 * @access  Privé (Pressing)
 */
const deleteService = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { serviceId } = req.params;

    console.log('🗑️ Suppression service pour le pressing:', pressingId);
    console.log('🔧 Service ID:', serviceId);

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Trouver l'index du service à supprimer
    const serviceIndex = pressing.services.findIndex(service => 
      service._id.toString() === serviceId
    );

    if (serviceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Service non trouvé'
      });
    }

    // Supprimer le service
    pressing.services.splice(serviceIndex, 1);
    await pressing.save();

    console.log('✅ Service supprimé avec succès');

    res.status(200).json({
      success: true,
      message: 'Service supprimé avec succès'
    });
  } catch (error) {
    console.log('❌ Erreur lors de la suppression du service:', error);
    next(error);
  }
};

/**
 * @desc    Activer/désactiver un service
 * @route   PATCH /api/v1/pressing/services/:serviceId/toggle
 * @access  Privé (Pressing)
 */
const toggleServiceAvailability = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { serviceId } = req.params;
    
    console.log('🔄 Basculer disponibilité service pour le pressing:', pressingId);
    console.log('🔧 Service ID:', serviceId);

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Trouver le service
    const service = pressing.services.find(service => 
      service._id.toString() === serviceId
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service non trouvé'
      });
    }

    // Basculer la disponibilité
    service.isAvailable = !service.isAvailable;
    await pressing.save();

    console.log(`✅ Service ${service.isAvailable ? 'activé' : 'désactivé'} avec succès`);

    res.status(200).json({
      success: true,
      message: `Service ${service.isAvailable ? 'activé' : 'désactivé'} avec succès`,
      data: service
    });
  } catch (error) {
    console.log('❌ Erreur lors du basculement de disponibilité:', error);
    next(error);
  }
};

/**
 * @desc    Récupérer un service spécifique
 * @route   GET /api/v1/pressing/services/:serviceId
 * @access  Privé (Pressing)
 */
const getService = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { serviceId } = req.params;

    console.log('🔍 Récupération service spécifique pour le pressing:', pressingId);
    console.log('🔧 Service ID:', serviceId);

    const pressing = await Pressing.findById(pressingId).select('services');
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Trouver le service
    const service = pressing.services.find(service => 
      service._id.toString() === serviceId
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service non trouvé'
      });
    }

    console.log('✅ Service trouvé:', service.name);

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    console.log('❌ Erreur lors de la récupération du service:', error);
    next(error);
  }
};

module.exports = {
  getMyServices,
  createService,
  updateService,
  deleteService,
  toggleServiceAvailability,
  getService
};
