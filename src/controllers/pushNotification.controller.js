const pushNotificationService = require('../services/pushNotification.service');
const { ErrorResponse } = require('../utils/error.utils');
const logger = require('../utils/logger');

/**
 * @desc    Sauvegarder une subscription push
 * @route   POST /api/v1/push/subscribe
 * @access  Private
 */
const subscribe = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;
    const userType = req.user.role;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        message: 'Données de subscription invalides'
      });
    }

    const savedSubscription = await pushNotificationService.saveSubscription(
      userId,
      userType,
      subscription
    );

    res.status(201).json({
      success: true,
      message: 'Subscription push enregistrée avec succès',
      data: {
        id: savedSubscription._id,
        endpoint: savedSubscription.endpoint,
        createdAt: savedSubscription.createdAt
      }
    });

  } catch (error) {
    logger.error('Erreur lors de l\'enregistrement de la subscription push:', error);
    next(new ErrorResponse('Erreur lors de l\'enregistrement de la subscription push', 500));
  }
};

/**
 * @desc    Supprimer une subscription push
 * @route   DELETE /api/v1/push/unsubscribe
 * @access  Private
 */
const unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint de subscription requis'
      });
    }

    const removed = await pushNotificationService.removeSubscription(endpoint);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Subscription non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription supprimée avec succès'
    });

  } catch (error) {
    logger.error('Erreur lors de la suppression de la subscription push:', error);
    next(new ErrorResponse('Erreur lors de la suppression de la subscription push', 500));
  }
};

/**
 * @desc    Envoyer une notification push de test
 * @route   POST /api/v1/push/test
 * @access  Private
 */
const sendTestNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, body, data } = req.body;

    const payload = {
      title: title || '🧪 Notification de test',
      body: body || 'Ceci est une notification push de test depuis GeoPressCI',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'test-notification',
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
        ...data
      }
    };

    const result = await pushNotificationService.sendPushToUser(userId, payload);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Échec de l\'envoi de la notification'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification de test envoyée avec succès',
      data: {
        sent: result.results.filter(r => r.success).length,
        total: result.results.length,
        failed: result.failedSubscriptions.length
      }
    });

  } catch (error) {
    logger.error('Erreur lors de l\'envoi de la notification de test:', error);
    next(new ErrorResponse('Erreur lors de l\'envoi de la notification de test', 500));
  }
};

/**
 * @desc    Envoyer une notification push personnalisée
 * @route   POST /api/v1/push/send
 * @access  Private (Admin uniquement)
 */
const sendCustomNotification = async (req, res, next) => {
  try {
    // Vérifier les permissions admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent envoyer des notifications personnalisées.'
      });
    }

    const { userIds, title, body, data, options } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Liste d\'utilisateurs requise'
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Titre et contenu de la notification requis'
      });
    }

    const payload = {
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: `custom-${Date.now()}`,
      data: {
        type: 'custom',
        timestamp: new Date().toISOString(),
        ...data
      }
    };

    const result = await pushNotificationService.sendPushToMultipleUsers(
      userIds,
      payload,
      options
    );

    res.status(200).json({
      success: true,
      message: 'Notifications envoyées',
      data: {
        totalUsers: result.totalUsers,
        successful: result.successful,
        failed: result.failed
      }
    });

  } catch (error) {
    logger.error('Erreur lors de l\'envoi de notifications personnalisées:', error);
    next(new ErrorResponse('Erreur lors de l\'envoi de notifications personnalisées', 500));
  }
};

/**
 * @desc    Obtenir les statistiques des subscriptions push
 * @route   GET /api/v1/push/stats
 * @access  Private (Admin uniquement)
 */
const getSubscriptionStats = async (req, res, next) => {
  try {
    // Vérifier les permissions admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent consulter les statistiques.'
      });
    }

    const stats = await pushNotificationService.getSubscriptionStats();

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération des statistiques:', error);
    next(new ErrorResponse('Erreur lors de la récupération des statistiques', 500));
  }
};

/**
 * @desc    Nettoyer les subscriptions inactives
 * @route   DELETE /api/v1/push/cleanup
 * @access  Private (Admin uniquement)
 */
const cleanupSubscriptions = async (req, res, next) => {
  try {
    // Vérifier les permissions admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent nettoyer les subscriptions.'
      });
    }

    const { daysOld } = req.query;
    const days = parseInt(daysOld) || 30;

    const deletedCount = await pushNotificationService.cleanupInactiveSubscriptions(days);

    res.status(200).json({
      success: true,
      message: `${deletedCount} subscriptions inactives supprimées`,
      data: {
        deletedCount,
        daysOld: days
      }
    });

  } catch (error) {
    logger.error('Erreur lors du nettoyage des subscriptions:', error);
    next(new ErrorResponse('Erreur lors du nettoyage des subscriptions', 500));
  }
};

/**
 * @desc    Envoyer une notification basée sur un template
 * @route   POST /api/v1/push/template/:templateName
 * @access  Private
 */
const sendTemplateNotification = async (req, res, next) => {
  try {
    const { templateName } = req.params;
    const { userId, data, options } = req.body;

    // Si pas d'userId spécifié, utiliser l'utilisateur connecté
    const targetUserId = userId || req.user.id;

    // Vérifier les permissions (seuls les admins peuvent envoyer à d'autres utilisateurs)
    if (userId && userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez envoyer des notifications qu\'à vous-même.'
      });
    }

    const result = await pushNotificationService.sendTemplatedPush(
      templateName,
      targetUserId,
      data,
      options
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Échec de l\'envoi de la notification'
      });
    }

    res.status(200).json({
      success: true,
      message: `Notification ${templateName} envoyée avec succès`,
      data: {
        template: templateName,
        sent: result.results.filter(r => r.success).length,
        total: result.results.length,
        failed: result.failedSubscriptions.length
      }
    });

  } catch (error) {
    logger.error(`Erreur lors de l'envoi de la notification template ${req.params.templateName}:`, error);
    next(new ErrorResponse('Erreur lors de l\'envoi de la notification template', 500));
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  sendTestNotification,
  sendCustomNotification,
  getSubscriptionStats,
  cleanupSubscriptions,
  sendTemplateNotification
};
