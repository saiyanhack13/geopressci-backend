const Order = require('../models/order.model');
const Pressing = require('../models/pressing.model');
const Client = require('../models/client.model');
const ClientDirect = require('../models/client-direct.model');
const { ErrorResponse, NotFoundError, BadRequestError, ForbiddenError } = require('../utils/error.utils');
const notificationService = require('../services/notification.service');
const recurringOrderService = require('../services/recurringOrder.service');
const logger = require('../utils/logger');

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Créer une nouvelle commande
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pressingId
 *               - services
 *               - adresseLivraison
 *             properties:
 *               pressingId:
 *                 type: string
 *                 example: '60d0fe4f5311236168a109ca'
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - serviceId
 *                     - quantite
 *                   properties:
 *                     serviceId:
 *                       type: string
 *                       example: '60d0fe4f5311236168a109cb'
 *                     quantite:
 *                       type: number
 *                       example: 2
 *                     instructions:
 *                       type: string
 *                       example: 'Repasser à basse température'
 *               adresseLivraison:
 *                 type: string
 *                 example: "Cocody, Abidjan, Côte d'Ivoire"
 *               dateRecuperationSouhaitee:
 *                 type: string
 *                 format: date-time
 *                 example: '2025-07-20T14:00:00Z'
 *               instructionsSpeciales:
 *                 type: string
 *                 example: 'Sonner deux fois à la porte'
 *     responses:
 *       201:
 *         description: Commande créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Commande'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Pressing ou service non trouvé
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const createOrder = async (req, res, next) => {
  try {
    const { 
      pressingId, 
      services, 
      adresseLivraison, 
      dateRecuperationSouhaitee, 
      instructionsSpeciales,
      // Nouvelles données depuis PressingDetailPage
      pressingName,
      pressingAddress,
      // Données supplémentaires depuis OrderCreatePage
      deliveryInstructions,
      specialInstructions,
      // Géolocalisation de livraison
      deliveryLocation
    } = req.body;
    const clientId = req.user.id;
    
    console.log('📦 Données reçues pour création commande:', {
      pressingId,
      pressingName,
      pressingAddress,
      servicesCount: services?.length,
      adresseLivraison,
      dateRecuperationSouhaitee,
      instructionsSpeciales,
      deliveryInstructions,
      specialInstructions
    });

    // Vérifier que le pressing existe
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new NotFoundError(`Pressing non trouvé avec l'ID ${pressingId}`);
    }

    // Vérifier que les services existent et calculer le montant total
    let montantTotal = 0;
    const servicesAvecDetails = [];

    for (const item of services) {
      console.log('🔍 Traitement service item:', {
        serviceId: item.serviceId,
        hasDetailedInfo: !!(item.nom || item.description || item.dureeMoyenne),
        fields: Object.keys(item)
      });
      
      // Chercher d'abord dans les services du pressing
      const service = pressing.services.find(s => s._id.toString() === item.serviceId);
      
      // Utiliser les données détaillées du service si disponibles (depuis PressingDetailPage)
      const serviceDetails = {
        // Nom du service (priorité aux données détaillées)
        name: item.nom || item.name || (service ? service.nom : 'Service'),
        
        // Description complète
        description: item.description || (service ? service.description : 'Service importé depuis une source externe'),
        
        // Prix (priorité aux données détaillées)
        price: item.prix || item.price || (service ? service.prix : 0),
        
        // Catégorie
        category: item.categorie || item.category || (service ? service.categorie : 'Général'),
        
        // Durée moyenne en minutes
        duration: item.dureeMoyenne || item.duration || (service ? service.dureeMoyenne : 0),
        
        // Disponibilité
        available: item.disponible !== undefined ? item.disponible : (service ? service.disponible : true),
        
        // Validité en jours
        validity: item.validite || (service ? service.validite : 30),
        
        // Options du service
        options: item.options || (service ? service.options : []),
        
        // Images du service
        images: item.images || (service ? service.images : []),
        
        // Métadonnées temporelles
        createdAt: item.createdAt || (service ? service.createdAt : null),
        updatedAt: item.updatedAt || (service ? service.updatedAt : null)
      };
      
      servicesAvecDetails.push({
        service: service ? service._id : item.serviceId,
        pressing: pressingId,
        serviceDetails,
        quantity: item.quantite || item.quantity || 1,
        unitPrice: serviceDetails.price,
        specialInstructions: item.instructions || '',
        
        // Informations supplémentaires pour le suivi
        metadata: {
          sourceType: service ? 'pressing_service' : 'imported_service',
          hasDetailedInfo: !!(item.nom || item.description || item.dureeMoyenne),
          estimatedDuration: (serviceDetails.duration || 0) * (item.quantite || item.quantity || 1)
        }
      });

      // Calculer le montant avec le prix le plus récent
      const finalPrice = serviceDetails.price;
      const quantity = item.quantite || item.quantity || 1;
      montantTotal += finalPrice * quantity;
      
      console.log('✅ Service traité:', {
        serviceId: item.serviceId,
        name: serviceDetails.name,
        price: finalPrice,
        quantity,
        subtotal: finalPrice * quantity
      });
    }

    // Traiter l'adresse de livraison avec géolocalisation
    let deliveryAddressData = null;
    if (adresseLivraison) {
      // Essayer de parser l'adresse si c'est un objet JSON
      let parsedAddress;
      try {
        parsedAddress = typeof adresseLivraison === 'string' ? JSON.parse(adresseLivraison) : adresseLivraison;
      } catch (e) {
        // Si ce n'est pas du JSON, traiter comme une chaîne simple
        parsedAddress = { formattedAddress: adresseLivraison };
      }

      deliveryAddressData = {
        type: 'Point',
        coordinates: parsedAddress.coordinates ? 
          [parsedAddress.coordinates.lng || parsedAddress.coordinates[0] || -3.9665738, 
           parsedAddress.coordinates.lat || parsedAddress.coordinates[1] || 5.3599517] : 
          [-3.9665738, 5.3599517], // Coordonnées par défaut d'Abidjan
        street: parsedAddress.street || '',
        city: parsedAddress.city || 'Abidjan',
        district: parsedAddress.district || '',
        postalCode: parsedAddress.postalCode || '00225',
        country: parsedAddress.country || 'Côte d\'Ivoire',
        formattedAddress: parsedAddress.formattedAddress || adresseLivraison
      };
    }

    // Traiter la date et heure de collecte
    const collectionDate = dateRecuperationSouhaitee ? new Date(dateRecuperationSouhaitee) : null;
    const timeSlotData = {
      type: collectionDate ? 'specific' : 'asap',
      preferredDate: collectionDate,
      startTime: collectionDate,
      endTime: collectionDate ? new Date(collectionDate.getTime() + 2 * 60 * 60 * 1000) : null, // +2h
      timezone: 'Africa/Abidjan'
    };

    // Calculer les frais supplémentaires
    const deliveryFee = adresseLivraison ? 1000 : 0; // 1000 XOF si livraison
    const serviceFee = Math.round(montantTotal * 0.05); // 5% de frais de service
    const taxRate = 0.18; // 18% TVA
    const taxAmount = Math.round((montantTotal + deliveryFee + serviceFee) * taxRate);
    
    // Calculer le montant total final
    const finalTotal = montantTotal + deliveryFee + serviceFee + taxAmount;
    
    console.log('💰 Calcul du montant total:', {
      subtotal: montantTotal,
      deliveryFee,
      serviceFee,
      taxAmount,
      finalTotal
    });
    
    // Préparer les frais supplémentaires
    const fees = [];
    if (serviceFee > 0) {
      fees.push({
        type: 'service',
        name: 'Frais de service',
        amount: serviceFee,
        description: 'Frais de traitement de la commande (5%)'
      });
    }
    if (deliveryFee > 0) {
      fees.push({
        type: 'delivery',
        name: 'Frais de livraison',
        amount: deliveryFee,
        description: 'Frais de livraison à domicile'
      });
    }

    // Créer et sauvegarder la commande avec les données complètes
    const order = await Order.create({
      customer: clientId,
      pressing: pressingId,
      items: servicesAvecDetails,
      
      // Adresse de livraison complète avec géolocalisation
      deliveryAddress: deliveryAddressData,
      
      // Géolocalisation de livraison pour la carte
      deliveryLocation: deliveryLocation ? {
        latitude: deliveryLocation.latitude || deliveryLocation.lat,
        longitude: deliveryLocation.longitude || deliveryLocation.lng,
        accuracy: deliveryLocation.accuracy || null,
        timestamp: new Date(),
        source: deliveryLocation.source || 'user_input' // 'gps', 'user_input', 'geocoding'
      } : null,
      
      // Adresse de livraison simple (pour compatibilité)
      adresseLivraison,
      
      // Type de service
      serviceType: adresseLivraison ? 'delivery' : 'pickup',
      
      // Créneau horaire structuré
      timeSlot: timeSlotData,
      
      // Statut et historique
      status: 'draft', // Statut conforme au modèle
      statusHistory: [{
        status: 'draft',
        changedAt: new Date(),
        changedBy: 'customer',
        notes: 'Commande créée par le client'
      }],
      
      // Informations de paiement
      payment: {
        method: 'cash',
        status: 'pending',
        amount: {
          subtotal: montantTotal,
          total: finalTotal,
          discount: 0,
          delivery: deliveryFee,
          tax: taxAmount,
          tip: 0,
          currency: 'XOF'
        },
        refunds: []
      },
      
      // Informations de livraison
      delivery: {
        status: 'pending'
      },
      
      // Évaluation (vide initialement)
      rating: {
        photos: []
      },
      
      // Frais supplémentaires
      fees: fees,
      
      // Instructions spéciales combinées
      specialInstructions: [
        instructionsSpeciales,
        deliveryInstructions,
        specialInstructions
      ].filter(Boolean).join(' | ') || '',
      
      // Métadonnées avec informations du pressing depuis PressingDetailPage
      metadata: {
        // Informations du pressing au moment de la commande
        pressingSnapshot: {
          id: pressingId,
          name: pressingName || pressing.businessName || pressing.nomCommerce,
          address: pressingAddress || pressing.address?.formattedAddress || 'Adresse non disponible',
          phone: pressing.phone || pressing.telephone
        },
        // Informations de la source de la commande
        orderSource: {
          fromPressingDetail: !!pressingName, // Indique si vient de PressingDetailPage
          collectionDateTimeOriginal: dateRecuperationSouhaitee,
          createdVia: 'web_app'
        },
        // Instructions détaillées par type
        instructionsBreakdown: {
          general: instructionsSpeciales || '',
          delivery: deliveryInstructions || '',
          special: specialInstructions || ''
        }
      }
    });

    // Récupérer les détails complets de la commande pour la notification
    const orderWithDetails = await Order.findById(order._id, null, { strictPopulate: false })
      .populate('customer', 'nom prenom email telephone')
      .populate('pressing', 'nomCommerce businessName phone email')
      .populate('items.service', 'nom prixUnitaire');

    // Récupérer le client complet
    const customer = await Client.findById(clientId);
    
    // Récupérer le pressing complet
    const pressingWithOwner = await Pressing.findById(pressingId);

    // Envoyer les notifications in-app (ne pas attendre la fin de l'envoi)
    notificationService.notifyNewOrder(orderWithDetails, customer, pressingWithOwner)
      .then(result => {
        logger.info(`Notifications in-app envoyées pour la commande ${order._id}:`, {
          customerNotified: !!result.results.customer,
          pressingNotified: !!result.results.pressing
        });
      })
      .catch(error => {
        logger.error('Erreur lors de l\'envoi des notifications in-app:', error);
        // Ne pas échouer la requête si l'envoi de la notification échoue
      });

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Récupérer la liste des commandes
 *     description: Récupère la liste des commandes selon le rôle de l'utilisateur
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: statut
 *         schema:
 *           type: string
 *           enum: [en_attente, confirmee, en_cours, terminee, annulee]
 *         description: Filtrer par statut de commande
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page pour la pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Nombre d'éléments par page (max 100)
 *     responses:
 *       200:
 *         description: Liste des commandes récupérée avec succès
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
 *                   example: 15
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
 *                     $ref: '#/components/schemas/Commande'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const { id: userId, role, pressingId } = req.user; // pressingId doit être ajouté au payload du token pour les utilisateurs pressing
    
    console.log('🔍 getOrders appelé:', {
      userId,
      role,
      pressingId,
      query: { status, search, page, limit }
    });

    let filter = {};

    // 1. Filtrer par rôle (insensible à la casse)
    const normalizedRole = role?.toLowerCase();
    
    if (normalizedRole === 'client') {
      filter.customer = userId; // Correction: utiliser 'customer' au lieu de 'client'
      console.log('👤 Filtre client appliqué:', { customer: userId });
    } else if (normalizedRole === 'pressing') {
      // Pour les pressings, utiliser l'ID utilisateur comme pressingId si pressingId n'est pas défini
      const effectivePressingId = pressingId || userId;
      if (!effectivePressingId) {
        throw new ForbiddenError('Cet utilisateur pressing n`est associé à aucun établissement.');
      }
      filter.pressing = effectivePressingId;
      console.log('🏢 Filtre pressing appliqué:', { pressing: effectivePressingId, original: { pressingId, userId } });
    } else if (normalizedRole !== 'admin') {
      // Si le rôle n'est ni client, ni pressing, ni admin, ne rien retourner
      console.log('❌ Rôle non autorisé:', role);
      return res.status(200).json({ success: true, count: 0, data: [] });
    } else {
      console.log('🔑 Accès admin - aucun filtre');
    }
    // Pour l'admin, aucun filtre par ID n'est appliqué, il voit tout.

    // 2. Filtrer par statut
    if (status) {
      filter.status = status; // Correction: utiliser 'status' au lieu de 'statut'
    }

    // 3. Filtrer par recherche (sur la référence de la order)
    if (search) {
      filter.orderNumber = { $regex: search, $options: 'i' }; // Correction: utiliser 'orderNumber' au lieu de 'reference'
    }

    console.log('🔍 Filtre final appliqué:', filter);
    
    const total = await Order.countDocuments(filter); // Correction: utiliser 'Order' au lieu de 'Commande'
    console.log('📊 Total commandes trouvées:', total);

    const orders = await Order.find(filter) // Correction: utiliser 'Order' au lieu de 'Commande'
      .populate({
        path: 'customer',
        model: 'ClientDirect',
        select: 'nom prenom email telephone'
      })
      .populate({
        path: 'pressing',
        model: 'Pressing',
        select: 'nomCommerce adresse telephone'
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
      
    console.log('📝 Commandes récupérées:', {
      count: orders.length,
      orderIds: orders.map(o => o._id),
      customerIds: orders.map(o => o.customer?._id || 'null')
    });

    const pagination = {};
    if ((page * limit) < total) {
      pagination.next = {
        page: parseInt(page) + 1,
        limit: parseInt(limit)
      };
    }

    if (page > 1) {
      pagination.prev = {
        page: page - 1,
        limit: parseInt(limit)
      };
    }

    res.status(200).json({
      success: true,
      count: orders.length, // Correction: utiliser 'orders' au lieu de 'commandes'
      total,
      pagination,
      data: orders, // Correction: utiliser 'orders' au lieu de 'commandes'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Récupérer une commande par son ID
 *     description: Récupère les détails d'une commande spécifique par son identifiant
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la commande à récupérer
 *     responses:
 *       200:
 *         description: Détails de la commande récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Commande'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès non autorisé à cette commande
 *       404:
 *         description: Commande non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('🔍 getOrder appelé avec ID:', id);
    console.log('👤 Utilisateur:', { role: req.user?.role, userId: req.user?.id, pressingId: req.user?.pressingId });
    
    // Valider que l'ID est un ObjectId MongoDB valide
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ ID invalide:', id);
      return res.status(400).json({
        success: false,
        message: `ID de commande invalide: ${id}. L'ID doit être un ObjectId MongoDB valide.`,
        error: 'INVALID_ORDER_ID'
      });
    }
    
    console.log('💾 Recherche commande dans la base...');
    const order = await Order.findById(id)
      .populate({
        path: 'customer',
        model: 'ClientDirect',
        select: 'nom prenom email telephone'
      })
      .populate({
        path: 'pressing',
        model: 'Pressing', 
        select: 'nomCommerce adresse telephone'
      });

    if (!order) {
      console.log('❌ Commande non trouvée:', id);
      throw new NotFoundError(`Commande non trouvée avec l'id ${req.params.id}`);
    }
    
    console.log('✅ Commande trouvée:', {
      orderId: order._id,
      customerId: order.customer?._id,
      pressingId: order.pressing?._id,
      status: order.status
    });
    
    // Vérifier l'intégrité des données et contrôler l'accès
    const { role, id: userId, pressingId } = req.user;
    
    // Pour les admins, toujours autoriser l'accès
    if (req.user.role === 'admin') {
      console.log('🔑 Accès admin autorisé');
      return res.status(200).json({ success: true, data: order });
    }
    
    // Pour les clients : vérifier l'intégrité et les permissions (insensible à la casse)
    if (req.user.role?.toLowerCase() === 'client') {
      if (!order.customer) {
        console.log('⚠️ Commande sans client associé, accès refusé pour le client');
        throw new NotFoundError('Commande introuvable');
      }
      
      const customerId = order.customer._id?.toString() || order.customer.toString();
      const userIdStr = (req.user.id || req.user.userId || userId).toString();
      if (customerId !== userIdStr) {
        console.log('❌ Accès refusé: client non autorisé', { customerId, userIdStr });
        throw new NotFoundError('Commande introuvable');
      }
      
      console.log('✅ Accès client autorisé');
      
      // Debug: Afficher les données envoyées au frontend
      console.log('📤 Données envoyées au frontend:');
      console.log('- Pressing populé:', order.pressing ? 'OUI' : 'NON');
      if (order.pressing) {
        console.log('  - Nom pressing:', order.pressing.nomCommerce || order.pressing.name);
        console.log('  - Adresse pressing:', order.pressing.adresse);
        console.log('  - Téléphone pressing:', order.pressing.telephone);
      }
      console.log('- Metadata pressingSnapshot:', order.metadata?.pressingSnapshot ? 'OUI' : 'NON');
      if (order.metadata?.pressingSnapshot) {
        console.log('  - Nom metadata:', order.metadata.pressingSnapshot.name);
        console.log('  - Téléphone metadata:', order.metadata.pressingSnapshot.phone);
      }
      
      return res.status(200).json({ success: true, data: order });
    }
    
    // Pour les pressings : vérifier l'intégrité et les permissions (insensible à la casse)
    if (req.user.role?.toLowerCase() === 'pressing') {
      if (!order.pressing) {
        console.log('⚠️ Commande sans pressing associé, accès refusé pour le pressing');
        throw new NotFoundError('Commande introuvable');
      }
      
      const orderPressingId = order.pressing._id?.toString() || order.pressing.toString();
      // Utiliser userId comme fallback si pressingId n'est pas défini
      const effectivePressingId = req.user.pressingId || pressingId || req.user.id || userId;
      const pressingIdStr = effectivePressingId.toString();
      
      console.log('🔍 Vérification pressing:', {
        orderPressingId,
        pressingIdStr,
        userPressingId: req.user.pressingId,
        userId: req.user.id || userId
      });
      
      if (orderPressingId !== pressingIdStr) {
        console.log('❌ Accès refusé: pressing non autorisé', { orderPressingId, pressingIdStr });
        throw new NotFoundError('Commande introuvable');
      }
      
      console.log('✅ Accès pressing autorisé');
      return res.status(200).json({ success: true, data: order });
    }
    
    // Fallback pour les autres rôles
    const isClientOwner = order.customer?._id?.toString() === req.user.userId;
    const isPressingOwner = req.user.role === 'pressing' && order.pressing?._id?.toString() === req.user.pressingId;
    
    console.log('🔐 Vérification permissions:', {
      role: req.user.role,
      userId: req.user.userId,
      pressingId: req.user.pressingId,
      role,
      userId,
      pressingId,
      isClientOwner,
      isPressingOwner
    });

    if (!isClientOwner && !isPressingOwner) {
      console.log('❌ Accès refusé');
      throw new ForbiddenError('Non autorisé à accéder à cette commande');
    }
    
    console.log('✅ Accès autorisé, envoi de la réponse');
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /orders/{id}/statut:
 *   put:
 *     summary: Mettre à jour le statut d'une commande
 *     description: Permet à un pressing ou à un administrateur de mettre à jour le statut d'une commande
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la commande à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - statut
 *             properties:
 *               statut:
 *                 type: string
 *                 enum: [en_attente, confirmee, en_cours, terminee, annulee]
 *                 description: Nouveau statut de la commande
 *               commentaire:
 *                 type: string
 *                 description: Commentaire optionnel pour la mise à jour du statut
 *                 example: 'Commande en cours de traitement par notre équipe'
 *     responses:
 *       200:
 *         description: Statut de la commande mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Statut de la commande mis à jour avec succès'
 *                 data:
 *                   $ref: '#/components/schemas/Commande'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Action non autorisée pour cet utilisateur
 *       404:
 *         description: Commande non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Fonction pour mapper les statuts frontend vers les statuts backend valides
const mapFrontendStatusToBackend = (frontendStatus) => {
  const statusMap = {
    // Statuts français vers anglais
    'en_attente': 'pending',
    'confirmee': 'confirmed', 
    'en_traitement': 'processing',
    'en_cours': 'processing',
    'prete': 'ready_for_pickup',
    'pret': 'ready_for_pickup',
    'livree': 'completed',
    'livre': 'completed',
    'annulee': 'cancelled',
    'annule': 'cancelled',
    // Statuts anglais (pass-through)
    'draft': 'draft',
    'pending': 'pending',
    'confirmed': 'confirmed',
    'processing': 'processing',
    'ready_for_pickup': 'ready_for_pickup',
    'out_for_delivery': 'out_for_delivery',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'refunded': 'refunded',
    'on_hold': 'on_hold'
  };
  
  return statusMap[frontendStatus] || 'pending';
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { statut, status, commentaire } = req.body;
    const frontendStatus = statut || status;

    if (!frontendStatus) {
      throw new BadRequestError('Le nouveau statut est requis.');
    }
    
    // Mapper le statut frontend vers le statut backend valide
    const newStatus = mapFrontendStatusToBackend(frontendStatus);
    
    console.log('🔄 Mapping statut:', {
      frontend: frontendStatus,
      backend: newStatus
    });

    const order = await Order.findById(id);

    if (!order) {
      throw new NotFoundError(`Commande non trouvée avec l'id ${id}`);
    }

    // Vérification des permissions
    const { role, pressingId, id: userId } = req.user;
    
    console.log('🔐 Vérification permissions:', {
      userRole: role,
      userPressingId: pressingId,
      userId: userId,
      orderPressingId: order.pressing?.toString(),
      orderPressing: order.pressing
    });
    
    // Pour les pressings, vérifier si l'utilisateur est associé au pressing de la commande
    const normalizedRole = role?.toLowerCase();
    let isAuthorized = false;
    
    if (normalizedRole === 'admin') {
      isAuthorized = true;
    } else if (normalizedRole === 'pressing') {
      // Vérifier plusieurs façons d'associer l'utilisateur au pressing
      const orderPressingId = order.pressing?.toString();
      isAuthorized = (
        (pressingId && orderPressingId === pressingId) || // pressingId dans le token
        (userId && orderPressingId === userId) || // userId correspond au pressing
        (userId && pressingId && userId === pressingId) // userId est le pressingId
      );
    }
    
    console.log('🔐 Résultat autorisation:', { isAuthorized });
    
    if (!isAuthorized) {
      throw new ForbiddenError('Non autorisé à modifier le statut de cette commande');
    }

    const ancienStatut = order.status;

    // Mettre à jour le statut et l'historique
    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      changedBy: 'pressing',
      notes: commentaire || `Statut mis à jour: ${newStatus}`,
    });

    if (newStatus === 'completed' && !order.delivery.actualDeliveryTime) {
      order.delivery.actualDeliveryTime = new Date();
    }

    await order.save();

    // Si le statut a changé, envoyer une notification
    if (ancienStatut !== newStatus) {
      const orderAvecDetails = await Order.findById(order._id)
          .populate('customer', 'nom prenom email telephone')
          .populate('pressing', 'nomCommerce');

      // Envoyer notification si le service existe
      if (notificationService && notificationService.sendOrderStatusUpdateNotification) {
        notificationService.sendOrderStatusUpdateNotification(orderAvecDetails, ancienStatut)
          .catch(error => logger.error('Erreur lors de l\'envoi de la notification de mise à jour de statut:', error));
      }
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /orders/{id}/annuler:
 *   put:
 *     summary: Annuler une commande
 *     description: Permet à un client d'annuler sa commande ou à un administrateur d'annuler n'importe quelle commande
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la commande à annuler
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               raison:
 *                 type: string
 *                 description: Raison de l'annulation (optionnel)
 *                 example: 'Changement de programme'
 *     responses:
 *       200:
 *         description: Commande annulée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Commande annulée avec succès'
 *                 data:
 *                   $ref: '#/components/schemas/Commande'
 *       400:
 *         description: Impossible d'annuler cette commande
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
 *                   example: "Impossible d'annuler une commande déjà en cours de traitement"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Action non autorisée pour cet utilisateur
 *       404:
 *         description: Commande non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const cancelOrder = async (req, res, next) => {
  try {
    let order;
    
    // Un client ne peut annuler que ses propres commandes
    if (req.user.role === 'client') {
      commande = await Commande.findOne({
        _id: req.params.id,
        client: req.user.id,
        statut: { $in: ['en_attente', 'confirmee'] }, // Ne peut annuler que si la commande est en attente ou confirmée
      });
    } 
    // Un admin peut annuler n'importe quelle commande
    else if (req.user.role === 'admin') {
      commande = await Commande.findById(req.params.id);
    } else {
      throw new ErrorResponse('Non autorisé', 403);
    }

    if (!order) {
      throw new NotFoundError(`Commande non trouvée ou ne peut pas être annulée`);
    }

    // Sauvegarder l'ancien statut pour la notification
    const ancienStatut = order.statut;
    const commentaire = req.body.commentaire || 'Commande annulée par le client';
    
    // Mettre à jour le statut
    order.statut = 'annulee';
    order.historiqueStatuts.push({
      statut: 'annulee',
      date: new Date(),
      commentaire: commentaire,
    });

    await order.save();

    // Envoyer une notification d'annulation (ne pas attendre la fin de l'envoi)
    if (ancienStatut !== 'annulee') {
      const orderAvecDetails = await commande
        .populate('customer', 'nom prenom email telephone')
        .populate('pressing', 'nomCommerce')
        .execPopulate();
      
      notificationController.sendCustomNotification(
        commandeAvecDetails.customer,
        {
          subject: `Commande #${commandeAvecDetails.reference} annulée`,
          message: `Votre commande #${commandeAvecDetails.reference} a été annulée.${commentaire ? `\n\nRaison: ${commentaire}` : ''}`,
          type: 'both',
        }
      ).catch(error => {
        logger.error('Erreur lors de l\'envoi de la notification d\'annulation:', error);
      });

      // Notifier également le pressing
      const pressingUser = await User.findById(commandeAvecDetails.pressing._id);
      if (pressingUser) {
        notificationController.sendCustomNotification(
          pressingUser,
          {
            subject: `Commande #${commandeAvecDetails.reference} annulée`,
            message: `La commande #${commandeAvecDetails.reference} a été annulée par ${commandeAvecDetails.customer.prenom} ${commandeAvecDetails.customer.nom}.${commentaire ? `\n\nRaison: ${commentaire}` : ''}`,
            type: 'email',
          }
        ).catch(error => {
          logger.error('Erreur lors de l\'envoi de la notification d\'annulation au pressing:', error);
        });
      }
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /orders/{id}/noter:
 *   post:
 *     summary: Noter une commande terminée
 *     description: Permet à un client de noter une commande terminée et de laisser un avis
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la commande à noter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - note
 *             properties:
 *               note:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Note attribuée (1 à 5 étoiles)
 *                 example: 5
 *               commentaire:
 *                 type: string
 *                 description: Commentaire optionnel sur la prestation
 *                 example: "Service rapide et professionnel, linge impeccable !"
 *     responses:
 *       200:
 *         description: Commande notée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Merci pour votre évaluation !'
 *                 data:
 *                   type: object
 *                   properties:
 *                     commande:
 *                       $ref: '#/components/schemas/Commande'
 *                     avis:
 *                       $ref: '#/components/schemas/Avis'
 *       400:
 *         description: Impossible de noter cette commande
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
 *                   example: "Vous ne pouvez pas noter une commande qui n'est pas terminée"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Action non autorisée
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
 *                   example: 'Seul le client ayant passé la commande peut la noter'
 *       404:
 *         description: Commande non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const reviewOrder = async (req, res, next) => {
  try {
    const { note, commentaire } = req.body;

    // Vérifier que la note est valide
    if (!note || note < 1 || note > 5) {
      throw new BadRequestError('La note doit être comprise entre 1 et 5');
    }

    // Trouver la commande
    const order = await Commande.findOne({
      _id: req.params.id,
      client: req.user.id,
      statut: 'terminee', // Ne peut noter qu'une commande terminée
    });

    if (!order) {
      throw new NotFoundError('Commande non trouvée ou non éligible à une évaluation');
    }

    // Vérifier si la commande a déjà été notée
    if (order.evaluation && order.evaluation.note) {
      throw new BadRequestError('Cette commande a déjà été notée');
    }

    // Mettre à jour l'évaluation
    order.evaluation = {
      note,
      commentaire: commentaire || '',
      dateEvaluation: new Date(),
    };

    await order.save();

    // Mettre à jour la note moyenne du pressing
    await updateNoteMoyennePressing(order.pressing);

    // Envoyer une notification de remerciement pour l'évaluation (ne pas attendre la fin de l'envoi)
    const orderAvecDetails = await commande
      .populate('pressing', 'nomCommerce')
      .populate('customer', 'nom prenom email telephone')
      .execPopulate();

    notificationController.sendCustomNotification(
      commandeAvecDetails.customer,
      {
        subject: 'Merci pour votre évaluation !',
        message: `Merci d'avoir évalué votre expérience avec ${commandeAvecDetails.pressing.nomCommerce}. Votre avis nous aide à améliorer nos services.`,
      }
    ).catch(error => {
      logger.error('Erreur lors de l\'envoi de la notification de remerciement pour l\'évaluation:', error);
    });

    // Notifier le pressing de la nouvelle évaluation
    const pressingUser = await User.findById(commandeAvecDetails.pressing._id);
    if (pressingUser) {
      notificationController.sendCustomNotification(
        pressingUser,
        {
          subject: 'Nouvelle évaluation reçue',
          message: `Vous avez reçu une nouvelle évaluation de ${commandeAvecDetails.customer.prenom} ${commandeAvecDetails.customer.nom} pour la commande #${commandeAvecDetails.reference}. Note: ${note}/5`,
        }
      ).catch(error => {
        logger.error('Erreur lors de l\'envoi de la notification d\'évaluation au pressing:', error);
      });
    }

    res.json({
      success: true,
      data: order.evaluation,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Vérifie si l'utilisateur a la permission d'accéder à la commande
 * @param {Object} commande - Commande à vérifier
 * @param {Object} user - Utilisateur actuel
 * @returns {boolean} - True si l'utilisateur a la permission
 */
const hasPermission = (order, user) => {
  // L'admin a accès à toutes les commandes
  if (user.role === 'admin') return true;
  
  // Le client a accès à ses propres commandes
  if (user.role === 'client' && order.customer.toString() === user.id) return true;
  
  // Le pressing a accès à ses propres commandes
  if (user.role === 'pressing' && order.pressing.toString() === user.id) return true;
  
  return false;
};

/**
 * @swagger
 * /orders/recurrentes:
 *   post:
 *     summary: Créer une commande récurrente
 *     description: Permet à un client de créer une commande récurrente basée sur une commande existante
 *     tags: [Commandes Récurrentes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - frequency
 *               - startDate
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: ID de la commande à dupliquer
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, biweekly, monthly]
 *                 description: Fréquence de récurrence
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date de début de la récurrence
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date de fin de la récurrence (optionnel)
 *               occurrences:
 *                 type: integer
 *                 description: Nombre d'occurrences (optionnel)
 *     responses:
 *       201:
 *         description: Commande récurrente créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Commande non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const createRecurringOrder = async (req, res, next) => {
  try {
    const { orderId, frequency, startDate, endDate, occurrences } = req.body;
    const userId = req.user.id;

    const recurringOrder = await recurringOrderService.createRecurringOrder(orderId, {
      frequency,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      occurrences,
      userId
    });

    res.status(201).json({
      success: true,
      data: recurringOrder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /orders/recurrentes:
 *   get:
 *     summary: Récupérer les commandes récurrentes de l'utilisateur
 *     description: Permet à un utilisateur de récupérer la liste de ses commandes récurrentes
 *     tags: [Commandes Récurrentes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des commandes récurrentes récupérée avec succès
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
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getRecurringOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orders = await recurringOrderService.getUserRecurringOrders(userId);
    
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /orders/recurrentes/{id}:
 *   put:
 *     summary: Mettre à jour une commande récurrente
 *     description: Permet de modifier les paramètres d'une commande récurrente
 *     tags: [Commandes Récurrentes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la commande récurrente à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, biweekly, monthly]
 *                 description: Nouvelle fréquence de récurrence
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Nouvelle date de fin de récurrence
 *               isActive:
 *                 type: boolean
 *                 description: Active ou désactive la récurrence
 *     responses:
 *       200:
 *         description: Commande récurrente mise à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Action non autorisée
 *       404:
 *         description: Commande récurrente non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateRecurringOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Vérifier que l'utilisateur a le droit de modifier cette commande
    const order = await Commande.findById(id);
    if (!order) {
      throw new NotFoundError('Commande non trouvée');
    }

    if (order.customer.toString() !== userId) {
      throw new ForbiddenError('Non autorisé à modifier cette commande');
    }

    const updatedOrder = await recurringOrderService.updateRecurringOrder(id, updates);
    
    res.status(200).json({
      success: true,
      data: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /orders/recurrentes/{id}:
 *   delete:
 *     summary: Désactiver une commande récurrente
 *     description: Permet de désactiver une commande récurrente
 *     tags: [Commandes Récurrentes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la commande récurrente à désactiver
 *     responses:
 *       200:
 *         description: Commande récurrente désactivée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Commande récurrente désactivée avec succès'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Action non autorisée
 *       404:
 *         description: Commande récurrente non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deactivateRecurringOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Vérifier que l'utilisateur a le droit de modifier cette commande
    const order = await Commande.findById(id);
    if (!order) {
      throw new NotFoundError('Commande non trouvée');
    }

    if (order.customer.toString() !== userId) {
      throw new ForbiddenError('Non autorisé à modifier cette commande');
    }

    await recurringOrderService.deactivateRecurringOrder(id);
    
    res.status(200).json({
      success: true,
      message: 'Commande récurrente désactivée avec succès'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /orders/{id}/tracking:
 *   get:
 *     summary: Obtenir le suivi temps réel d'une commande
 *     description: Récupère les informations de suivi détaillées d'une commande avec historique des statuts
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la commande
 *     responses:
 *       200:
 *         description: Informations de suivi de la commande
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
 *                   properties:
 *                     orderId:
 *                       type: string
 *                     orderNumber:
 *                       type: string
 *                     currentStatus:
 *                       type: string
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *                     trackingHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           description:
 *                             type: string
 *                           location:
 *                             type: string
 *                     deliveryInfo:
 *                       type: object
 *                       properties:
 *                         estimatedDelivery:
 *                           type: string
 *                           format: date-time
 *                         deliveryAddress:
 *                           type: string
 *                         deliveryInstructions:
 *                           type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès non autorisé à cette commande
 *       404:
 *         description: Commande non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getOrderTracking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Récupérer la commande avec les détails nécessaires
    const order = await Commande.findById(id)
      .populate('pressing', 'nom adresse telephone')
      .populate('customer', 'nom prenom telephone')
      .select('orderNumber statut historiqueStatuts dateCreation dateRecuperationSouhaitee adresseLivraison instructionsSpeciales montantTotal pressing customer');

    if (!order) {
      throw new NotFoundError('Commande non trouvée');
    }

    // Vérifier les permissions
    if (!hasPermission(order, req.user)) {
      throw new ForbiddenError('Accès non autorisé à cette commande');
    }

    // Construire l'historique de suivi
    const trackingHistory = order.historiqueStatuts.map(entry => ({
      status: entry.statut,
      timestamp: entry.date,
      description: getStatusDescription(entry.statut),
      location: order.pressing ? order.pressing.nom : 'Pressing',
      updatedBy: entry.utilisateur || 'Système'
    }));

    // Calculer la date de livraison estimée
    const estimatedCompletion = calculateEstimatedCompletion(order);
    const estimatedDelivery = calculateEstimatedDelivery(order);

    // Construire la réponse
    const trackingData = {
      orderId: order._id,
      orderNumber: order.orderNumber || order.reference,
      currentStatus: order.statut,
      estimatedCompletion,
      trackingHistory: trackingHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      deliveryInfo: {
        estimatedDelivery,
        deliveryAddress: order.adresseLivraison,
        deliveryInstructions: order.instructionsSpeciales || 'Aucune instruction spéciale'
      },
      pressingInfo: order.pressing ? {
        name: order.pressing.nom,
        address: order.pressing.adresse,
        phone: order.pressing.telephone
      } : null,
      orderValue: order.montantTotal,
      createdAt: order.dateCreation
    };

    res.status(200).json({
      success: true,
      data: trackingData
    });

  } catch (error) {
    next(error);
  }
};

// Fonction utilitaire pour obtenir la description d'un statut
const getStatusDescription = (status) => {
  const descriptions = {
    'en_attente': 'Commande reçue et en attente de traitement',
    'confirmee': 'Commande confirmée par le pressing',
    'en_cours_collecte': 'Collecte des articles en cours',
    'collectee': 'Articles collectés avec succès',
    'en_traitement': 'Articles en cours de traitement',
    'prete': 'Commande prête pour la livraison',
    'en_livraison': 'Commande en cours de livraison',
    'livree': 'Commande livrée avec succès',
    'terminee': 'Commande terminée',
    'annulee': 'Commande annulée'
  };
  return descriptions[status] || 'Statut inconnu';
};

// Fonction utilitaire pour calculer la date d'achèvement estimée
const calculateEstimatedCompletion = (order) => {
  if (order.statut === 'livree' || order.statut === 'terminee') {
    return order.historiqueStatuts
      .find(h => h.statut === 'livree' || h.statut === 'terminee')?.date;
  }

  // Estimation basée sur le statut actuel et les délais moyens
  const now = new Date();
  const statusDelays = {
    'en_attente': 2, // 2 heures
    'confirmee': 4, // 4 heures
    'en_cours_collecte': 6, // 6 heures
    'collectee': 24, // 24 heures
    'en_traitement': 48, // 48 heures
    'prete': 2, // 2 heures
    'en_livraison': 4 // 4 heures
  };

  const delayHours = statusDelays[order.statut] || 24;
  return new Date(now.getTime() + delayHours * 60 * 60 * 1000);
};

// Fonction utilitaire pour calculer la date de livraison estimée
const calculateEstimatedDelivery = (order) => {
  if (order.dateRecuperationSouhaitee) {
    return order.dateRecuperationSouhaitee;
  }

  // Si pas de date souhaitée, estimer 72h après création
  const creationDate = new Date(order.dateCreation);
  return new Date(creationDate.getTime() + 72 * 60 * 60 * 1000);
};

/**
 * Fonction utilitaire pour mettre à jour la note moyenne d'un pressing
 * @param {string} pressingId - ID du pressing
 */
const updateNoteMoyennePressing = async (pressingId) => {
  try {
    const result = await Commande.aggregate([
      {
        $match: {
          pressing: pressingId,
          'evaluation.note': { $exists: true, $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$pressing',
          noteMoyenne: { $avg: '$evaluation.note' },
          nombreAvis: { $sum: 1 },
        },
      },
    ]);

    if (result.length > 0) {
      const { noteMoyenne, nombreAvis } = result[0];
      await Pressing.findByIdAndUpdate(pressingId, {
        noteMoyenne: parseFloat(noteMoyenne.toFixed(1)),
        nombreAvis,
      });
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la note moyenne du pressing:', error);
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  reviewOrder,
  getOrderTracking,
  createRecurringOrder,
  getRecurringOrders,
  updateRecurringOrder,
  deactivateRecurringOrder
};
