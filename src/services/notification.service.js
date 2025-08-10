const Notification = require('../models/notification.model');
const config = require('../config/config');
const logger = require('../utils/logger');

// Templates pour les notifications in-app
const notificationTemplates = {
  // Notification de bienvenue
  welcome: (user) => ({
    title: '🎉 Bienvenue sur GeoPressCI !',
    message: `Bonjour ${user.prenom || user.nom || 'Utilisateur'} ! Merci de vous être inscrit(e) sur notre plateforme de pressing en ligne. Commencez dès maintenant à profiter de nos services.`,
    type: 'account',
    priority: 3,
    actions: [{
      type: 'navigate',
      label: 'Découvrir les pressings',
      target: '/pressings'
    }]
  }),

  // Notification de nouvelle commande
  newOrder: (user, order) => ({
    title: '📦 Nouvelle commande créée',
    message: `Votre commande #${order.reference || order._id} a bien été enregistrée pour un montant de ${order.montantTotal || 0} FCFA.`,
    type: 'order',
    subtype: 'created',
    priority: 4,
    relatedTo: {
      order: order._id
    },
    actions: [{
      type: 'view_order',
      label: 'Voir la commande',
      target: `/orders/${order._id}`
    }]
  }),

  // Mise à jour du statut d'une commande
  orderStatusUpdate: (user, order, previousStatus) => ({
    title: '🔄 Mise à jour de commande',
    message: `Le statut de votre commande #${order.reference || order._id} a été mis à jour : ${getStatusLabel(order.statut || order.status)}.`,
    type: 'order',
    subtype: 'status_update',
    priority: 4,
    relatedTo: {
      order: order._id
    },
    data: {
      previousStatus,
      newStatus: order.statut || order.status
    },
    actions: [{
      type: 'view_order',
      label: 'Voir la commande',
      target: `/orders/${order._id}`
    }]
  }),

  // Notification pour pressing - nouvelle commande
  newOrderForPressing: (pressing, { order, customer }) => ({
    title: '🆕 Nouvelle commande reçue',
    message: `Une nouvelle commande #${order.reference || order._id} a été passée par ${customer.prenom || customer.nom || 'un client'} pour un montant de ${order.montantTotal || 0} FCFA.`,
    type: 'order',
    subtype: 'new_order_for_pressing',
    priority: 5,
    relatedTo: {
      order: order._id,
      customer: customer._id
    },
    data: {
      orderReference: order.reference,
      customerName: `${customer.prenom || ''} ${customer.nom || ''}`.trim(),
      customerPhone: customer.telephone,
      amount: order.montantTotal,
      items: order.items || [],
      deliveryAddress: {
        formatted: order.adresseLivraison,
        coordinates: order.deliveryLocation || null,
        mapUrl: order.deliveryLocation ? 
          `https://www.openstreetmap.org/?mlat=${order.deliveryLocation.latitude}&mlon=${order.deliveryLocation.longitude}&zoom=15` : null
      },
      pickupDate: order.dateRecuperation,
      deliveryDate: order.dateLivraison,
      // Informations de géolocalisation pour la carte
      geolocation: order.deliveryLocation ? {
        latitude: order.deliveryLocation.latitude,
        longitude: order.deliveryLocation.longitude,
        accuracy: order.deliveryLocation.accuracy || null,
        address: order.adresseLivraison,
        mapProvider: 'google', // ou 'openstreetmap'
        zoomLevel: 16
      } : null
    },
    actions: [{
      type: 'view_order',
      label: 'Voir la commande',
      target: `/pressing/orders/${order._id}`
    }, {
      type: 'accept_order',
      label: 'Accepter la commande',
      target: `/api/orders/${order._id}/accept`
    }, {
      type: 'contact_customer',
      label: 'Contacter le client',
      target: `tel:${customer.telephone || ''}`
    }, {
      type: 'view_map',
      label: '🗺️ Voir sur la carte',
      target: order.deliveryLocation ? 
        `/pressing/orders/${order._id}/map` : null,
      disabled: !order.deliveryLocation
    }, {
      type: 'get_directions',
      label: '🧭 Itinéraire',
      target: order.deliveryLocation ? 
        `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLocation.latitude},${order.deliveryLocation.longitude}` : null,
      disabled: !order.deliveryLocation,
      external: true
    }]
  }),

  // Notification personnalisée
  custom: (user, { subject, message, type = 'system', priority = 3, actions = [] }) => ({
    title: subject,
    message,
    type,
    priority,
    actions
  })
};

// Fonction utilitaire pour obtenir le libellé d'un statut
function getStatusLabel(status) {
  const statusLabels = {
    en_attente: 'En attente de confirmation',
    confirmee: 'Confirmée',
    en_cours: 'En cours de traitement',
    pret_a_recuperer: 'Prête à être récupérée',
    en_livraison: 'En cours de livraison',
    terminee: 'Terminée',
    annulee: 'Annulée',
    draft: 'Brouillon',
    pending: 'En attente',
    confirmed: 'Confirmée',
    in_progress: 'En cours',
    ready: 'Prête',
    delivered: 'Livrée',
    cancelled: 'Annulée'
  };
  return statusLabels[status] || status;
}

/**
 * Créer une notification in-app
 * @param {Object} recipient - Utilisateur destinataire
 * @param {Object} notificationData - Données de la notification
 * @returns {Promise<Object>} - Notification créée
 */
const createInAppNotification = async (recipient, notificationData) => {
  try {
    const notification = new Notification({
      recipient: recipient._id,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'system',
      subtype: notificationData.subtype,
      priority: notificationData.priority || 3,
      channels: {
        inApp: true,
        email: false,
        sms: false,
        push: false
      },
      relatedTo: notificationData.relatedTo || {},
      data: notificationData.data || {},
      actions: notificationData.actions || [],
      expiresAt: notificationData.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours par défaut
    });

    const savedNotification = await notification.save();
    logger.info(`Notification in-app créée pour l'utilisateur ${recipient._id}: ${notificationData.title}`);
    
    return { success: true, notification: savedNotification };
  } catch (error) {
    logger.error(`Erreur lors de la création de la notification in-app pour ${recipient._id}:`, error);
    throw new Error(`Échec de la création de la notification: ${error.message}`);
  }
};

/**
 * Créer une notification basée sur un template
 * @param {string} templateName - Nom du template à utiliser
 * @param {Object} user - Utilisateur destinataire
 * @param {Object} data - Données supplémentaires pour le template
 * @returns {Promise<Object>} - Notification créée
 */
const createTemplatedNotification = async (templateName, user, data = {}) => {
  try {
    const template = notificationTemplates[templateName];
    if (!template) {
      throw new Error(`Template de notification non trouvé: ${templateName}`);
    }

    const notificationData = template(user, data);
    return await createInAppNotification(user, notificationData);
  } catch (error) {
    logger.error(`Erreur lors de la création de la notification avec le template ${templateName}:`, error);
    throw error;
  }
};

/**
 * Notifier un pressing d'une nouvelle commande
 * @param {Object} pressing - Pressing destinataire
 * @param {Object} order - Commande créée
 * @param {Object} customer - Client qui a passé la commande
 * @returns {Promise<Object>} - Notification créée
 */
const notifyPressingNewOrder = async (pressing, order, customer) => {
  try {
    const notificationData = {
      title: '🆕 Nouvelle commande reçue',
      message: `Une nouvelle commande #${order.reference || order._id} a été passée par ${customer.prenom || customer.nom || 'un client'} pour un montant de ${order.montantTotal || 0} FCFA.`,
      type: 'order',
      subtype: 'new_order_for_pressing',
      priority: 5, // Priorité élevée pour les pressings
      relatedTo: {
        order: order._id,
        customer: customer._id
      },
      data: {
        orderReference: order.reference,
        customerName: `${customer.prenom || ''} ${customer.nom || ''}`.trim(),
        amount: order.montantTotal,
        items: order.items || []
      },
      actions: [{
        type: 'view_order',
        label: 'Voir la commande',
        target: `/pressing/orders/${order._id}`
      }, {
        type: 'accept_order',
        label: 'Accepter',
        target: `/api/orders/${order._id}/accept`
      }]
    };

    // Créer la notification pour le pressing directement
    return await createInAppNotification(pressing, notificationData);
  } catch (error) {
    logger.error(`Erreur lors de la notification du pressing ${pressing._id}:`, error);
    throw error;
  }
};

/**
 * Envoyer une notification in-app uniquement
 * @param {Object} user - Utilisateur destinataire
 * @param {Object} options - Options de notification
 * @param {string} options.template - Nom du template de notification
 * @param {Object} options.data - Données supplémentaires pour le template
 * @returns {Promise<Object>} - Résultat de la création de notification
 */
const sendNotification = async (user, { template, data = {} }) => {
  try {
    if (!template) {
      throw new Error('Template de notification requis');
    }

    return await createTemplatedNotification(template, user, data);
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de la notification:', error);
    throw error;
  }
};

/**
 * Notifier une nouvelle commande (client et pressing)
 * @param {Object} order - Commande créée
 * @param {Object} customer - Client qui a passé la commande
 * @param {Object} pressing - Pressing concerné
 * @returns {Promise<Object>} - Résultats des notifications
 */
const notifyNewOrder = async (order, customer, pressing) => {
  try {
    const results = {};

    // Notifier le client de la création de sa commande
    if (customer) {
      results.customer = await createTemplatedNotification('newOrder', customer, { order });
    }

    // Notifier le pressing de la nouvelle commande
    if (pressing) {
      results.pressing = await notifyPressingNewOrder(pressing, order, customer);
    }

    logger.info(`Notifications envoyées pour la commande ${order._id}`);
    return { success: true, results };
  } catch (error) {
    logger.error(`Erreur lors de la notification de la commande ${order._id}:`, error);
    throw error;
  }
};

/**
 * Obtenir les notifications d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} options - Options de filtrage
 * @returns {Promise<Array>} - Liste des notifications
 */
const getUserNotifications = async (userId, options = {}) => {
  try {
    const {
      limit = 20,
      skip = 0,
      unreadOnly = false,
      type = null
    } = options;

    const query = { recipient: userId };
    
    if (unreadOnly) {
      query.readAt = { $exists: false };
    }
    
    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('recipient', 'prenom nom email')
      .lean();

    return notifications;
  } catch (error) {
    logger.error(`Erreur lors de la récupération des notifications pour ${userId}:`, error);
    throw error;
  }
};

/**
 * Marquer une notification comme lue
 * @param {string} notificationId - ID de la notification
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Notification mise à jour
 */
const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification non trouvée');
    }

    return notification;
  } catch (error) {
    logger.error(`Erreur lors du marquage de la notification ${notificationId}:`, error);
    throw error;
  }
};

module.exports = {
  createInAppNotification,
  createTemplatedNotification,
  sendNotification,
  notifyNewOrder,
  notifyPressingNewOrder,
  getUserNotifications,
  markNotificationAsRead,
  getStatusLabel
};
