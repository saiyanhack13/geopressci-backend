/**
 * Service de notifications push pour GeoPressCI
 * Gestion des notifications push natives via Web Push API
 */

const webpush = require('web-push');
const PushSubscription = require('../models/pushSubscription.model');
const logger = require('../utils/logger');
const config = require('../config/config');

// Configuration Web Push
if (config.vapid && config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(
    config.vapid.subject || 'mailto:admin@geopressci.com',
    config.vapid.publicKey,
    config.vapid.privateKey
  );
}

/**
 * Templates de notifications push
 */
const pushTemplates = {
  newOrder: (order, customer) => ({
    title: '📦 Nouvelle commande',
    body: `Commande #${order.reference || order._id} de ${customer.prenom} ${customer.nom} - ${order.montantTotal || 0} FCFA`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `order-${order._id}`,
    data: {
      type: 'new_order',
      orderId: order._id,
      url: `/pressing/orders/${order._id}`
    },
    actions: [
      {
        action: 'view',
        title: 'Voir la commande',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'accept',
        title: 'Accepter',
        icon: '/icons/accept-icon.png'
      }
    ]
  }),

  orderStatusUpdate: (order, newStatus) => ({
    title: '🔄 Mise à jour de commande',
    body: `Commande #${order.reference || order._id} : ${getStatusLabel(newStatus)}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `order-update-${order._id}`,
    data: {
      type: 'order_status_update',
      orderId: order._id,
      status: newStatus,
      url: `/orders/${order._id}`
    }
  }),

  paymentReceived: (order, amount) => ({
    title: '💰 Paiement reçu',
    body: `Paiement de ${amount} FCFA reçu pour la commande #${order.reference || order._id}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `payment-${order._id}`,
    data: {
      type: 'payment_received',
      orderId: order._id,
      amount: amount,
      url: `/pressing/earnings`
    }
  }),

  newReview: (review, rating) => ({
    title: '⭐ Nouvel avis client',
    body: `Nouvel avis ${rating}/5 étoiles reçu`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `review-${review._id}`,
    data: {
      type: 'new_review',
      reviewId: review._id,
      rating: rating,
      url: `/pressing/reviews`
    }
  }),

  promotionAlert: (promotion) => ({
    title: '🎉 Promotion active',
    body: `${promotion.name} - ${promotion.description}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `promotion-${promotion._id}`,
    data: {
      type: 'promotion_alert',
      promotionId: promotion._id,
      url: `/pressing/promotions`
    }
  })
};

/**
 * Obtenir le libellé d'un statut de commande
 */
function getStatusLabel(status) {
  const labels = {
    'en_attente': 'En attente',
    'confirmee': 'Confirmée',
    'collecte_planifiee': 'Collecte planifiée',
    'en_collecte': 'En collecte',
    'collectee': 'Collectée',
    'en_traitement': 'En traitement',
    'traitement_termine': 'Traitement terminé',
    'livraison_planifiee': 'Livraison planifiée',
    'en_livraison': 'En livraison',
    'livree': 'Livrée',
    'retournee': 'Retournée',
    'annulee': 'Annulée'
  };
  return labels[status] || status;
}

/**
 * Sauvegarder une subscription push
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userType - Type d'utilisateur (client, pressing, admin)
 * @param {Object} subscription - Subscription Web Push
 * @returns {Promise<Object>} - Subscription sauvegardée
 */
const saveSubscription = async (userId, userType, subscription) => {
  try {
    // Vérifier si une subscription existe déjà pour cet endpoint
    const existingSubscription = await PushSubscription.findOne({
      endpoint: subscription.endpoint
    });

    if (existingSubscription) {
      // Mettre à jour la subscription existante
      existingSubscription.userId = userId;
      existingSubscription.userType = userType;
      existingSubscription.keys = subscription.keys;
      existingSubscription.lastUsed = new Date();
      await existingSubscription.save();
      
      logger.info(`Subscription mise à jour pour l'utilisateur ${userId}`);
      return existingSubscription;
    } else {
      // Créer une nouvelle subscription
      const newSubscription = new PushSubscription({
        userId,
        userType,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        lastUsed: new Date()
      });

      await newSubscription.save();
      logger.info(`Nouvelle subscription créée pour l'utilisateur ${userId}`);
      return newSubscription;
    }
  } catch (error) {
    logger.error('Erreur lors de la sauvegarde de la subscription:', error);
    throw error;
  }
};

/**
 * Supprimer une subscription push
 * @param {string} endpoint - Endpoint de la subscription
 * @returns {Promise<boolean>} - Succès de la suppression
 */
const removeSubscription = async (endpoint) => {
  try {
    const result = await PushSubscription.deleteOne({ endpoint });
    logger.info(`Subscription supprimée: ${endpoint}`);
    return result.deletedCount > 0;
  } catch (error) {
    logger.error('Erreur lors de la suppression de la subscription:', error);
    throw error;
  }
};

/**
 * Envoyer une notification push à un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} payload - Contenu de la notification
 * @param {Object} options - Options d'envoi
 * @returns {Promise<Object>} - Résultat de l'envoi
 */
const sendPushToUser = async (userId, payload, options = {}) => {
  try {
    // Récupérer toutes les subscriptions de l'utilisateur
    const subscriptions = await PushSubscription.find({ 
      userId,
      isActive: true 
    });

    if (subscriptions.length === 0) {
      logger.warn(`Aucune subscription active trouvée pour l'utilisateur ${userId}`);
      return { success: false, message: 'Aucune subscription active' };
    }

    const results = [];
    const failedSubscriptions = [];

    // Envoyer la notification à toutes les subscriptions
    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        };

        const result = await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(payload),
          {
            TTL: options.ttl || 86400, // 24 heures par défaut
            urgency: options.urgency || 'normal',
            topic: options.topic || payload.tag
          }
        );

        results.push({
          subscriptionId: subscription._id,
          success: true,
          statusCode: result.statusCode
        });

        // Mettre à jour la date de dernière utilisation
        subscription.lastUsed = new Date();
        await subscription.save();

      } catch (error) {
        logger.error(`Erreur lors de l'envoi push à la subscription ${subscription._id}:`, error);
        
        // Si la subscription est invalide, la marquer comme inactive
        if (error.statusCode === 410 || error.statusCode === 404) {
          subscription.isActive = false;
          await subscription.save();
          failedSubscriptions.push(subscription._id);
        }

        results.push({
          subscriptionId: subscription._id,
          success: false,
          error: error.message,
          statusCode: error.statusCode
        });
      }
    }

    logger.info(`Notification push envoyée à l'utilisateur ${userId}: ${results.filter(r => r.success).length}/${results.length} succès`);

    return {
      success: results.some(r => r.success),
      results,
      failedSubscriptions
    };

  } catch (error) {
    logger.error('Erreur lors de l\'envoi de notification push:', error);
    throw error;
  }
};

/**
 * Envoyer une notification push basée sur un template
 * @param {string} templateName - Nom du template
 * @param {string} userId - ID de l'utilisateur destinataire
 * @param {Object} data - Données pour le template
 * @param {Object} options - Options d'envoi
 * @returns {Promise<Object>} - Résultat de l'envoi
 */
const sendTemplatedPush = async (templateName, userId, data, options = {}) => {
  try {
    const template = pushTemplates[templateName];
    if (!template) {
      throw new Error(`Template de notification push non trouvé: ${templateName}`);
    }

    const payload = typeof template === 'function' ? template(data, data.extra) : template;
    
    return await sendPushToUser(userId, payload, options);
  } catch (error) {
    logger.error(`Erreur lors de l'envoi de notification push template ${templateName}:`, error);
    throw error;
  }
};

/**
 * Envoyer une notification push à plusieurs utilisateurs
 * @param {Array<string>} userIds - IDs des utilisateurs
 * @param {Object} payload - Contenu de la notification
 * @param {Object} options - Options d'envoi
 * @returns {Promise<Object>} - Résultats des envois
 */
const sendPushToMultipleUsers = async (userIds, payload, options = {}) => {
  try {
    const results = await Promise.allSettled(
      userIds.map(userId => sendPushToUser(userId, payload, options))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    logger.info(`Notification push envoyée à ${userIds.length} utilisateurs: ${successful} succès, ${failed} échecs`);

    return {
      success: successful > 0,
      totalUsers: userIds.length,
      successful,
      failed,
      results: results.map((result, index) => ({
        userId: userIds[index],
        ...result
      }))
    };

  } catch (error) {
    logger.error('Erreur lors de l\'envoi de notifications push multiples:', error);
    throw error;
  }
};

/**
 * Nettoyer les subscriptions inactives
 * @param {number} daysOld - Nombre de jours d'inactivité
 * @returns {Promise<number>} - Nombre de subscriptions supprimées
 */
const cleanupInactiveSubscriptions = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await PushSubscription.deleteMany({
      $or: [
        { isActive: false },
        { lastUsed: { $lt: cutoffDate } }
      ]
    });

    logger.info(`${result.deletedCount} subscriptions inactives supprimées`);
    return result.deletedCount;
  } catch (error) {
    logger.error('Erreur lors du nettoyage des subscriptions:', error);
    throw error;
  }
};

/**
 * Obtenir les statistiques des subscriptions
 * @returns {Promise<Object>} - Statistiques
 */
const getSubscriptionStats = async () => {
  try {
    const stats = await PushSubscription.aggregate([
      {
        $group: {
          _id: '$userType',
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          }
        }
      }
    ]);

    const totalSubscriptions = await PushSubscription.countDocuments();
    const activeSubscriptions = await PushSubscription.countDocuments({ isActive: true });

    return {
      total: totalSubscriptions,
      active: activeSubscriptions,
      inactive: totalSubscriptions - activeSubscriptions,
      byUserType: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          total: stat.total,
          active: stat.active,
          inactive: stat.total - stat.active
        };
        return acc;
      }, {})
    };
  } catch (error) {
    logger.error('Erreur lors de la récupération des statistiques:', error);
    throw error;
  }
};

module.exports = {
  saveSubscription,
  removeSubscription,
  sendPushToUser,
  sendTemplatedPush,
  sendPushToMultipleUsers,
  cleanupInactiveSubscriptions,
  getSubscriptionStats,
  pushTemplates
};
