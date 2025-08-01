const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const notificationService = require('../services/notification.service');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Envoyer une notification de bienvenue à un nouvel utilisateur
 * @param {Object} user - L'utilisateur à qui envoyer la notification
 * @param {string} [type] - Type de notification (email, sms, both)
 */
const sendWelcomeNotification = async (user, type = config.notifications.defaultType) => {
  if (!config.notifications.enabled) {
    logger.info('Notifications désactivées. Notification de bienvenue non envoyée.');
    return { success: false, message: 'Notifications désactivées' };
  }

  try {
    return await notificationService.sendNotification(
      user,
      {
        type,
        template: 'welcome',
        data: {},
      }
    );
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de la notification de bienvenue:', error);
    throw error;
  }
};

/**
 * Envoyer une notification de nouvelle commande
 * @param {Object} order - La commande concernée
 * @param {string} [type] - Type de notification (email, sms, both)
 */
const sendNewOrderNotification = async (order, type = config.notifications.defaultType) => {
  if (!config.notifications.enabled) {
    logger.info('Notifications désactivées. Notification de nouvelle commande non envoyée.');
    return { success: false, message: 'Notifications désactivées' };
  }

  try {
    // Récupérer les détails complets de la commande
    const Order = require('../models/order.model');
    const User = require('../models/user.model');
    
    const orderWithDetails = await Order.findById(order._id)
      .populate('pressing', 'nomCommerce');
      
    // Charger l'utilisateur séparément
    const customer = await User.findById(orderWithDetails.customer);
    if (!customer) {
      throw new Error('Utilisateur non trouvé pour cette commande');
    }

    // Envoyer une notification au client
    const clientResult = await notificationService.sendNotification(
      customer,
      {
        type,
        template: 'newOrder',
        data: {
          order: {
            reference: orderWithDetails._id,
            montantTotal: orderWithDetails.montantTotal,
            statut: orderWithDetails.statut,
          },
        },
      }
    );

    // Envoyer une notification au pressing
    const pressingUser = await User.findById(orderWithDetails.pressing._id);
    const pressingResult = await notificationService.sendNotification(
      pressingUser,
      {
        type,
        smsMessage: `Nouvelle commande #${orderWithDetails._id} reçue pour un montant de ${orderWithDetails.montantTotal} FCFA`,
        data: {
          order: {
            reference: orderWithDetails._id,
            montantTotal: orderWithDetails.montantTotal,
            statut: orderWithDetails.statut,
          },
        },
      }
    );

    return {
      success: true,
      results: {
        client: clientResult,
        pressing: pressingResult,
      },
    };
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de la notification de nouvelle commande:', error);
    throw error;
  }
};

/**
 * Envoyer une notification de mise à jour de statut de commande
 * @param {Object} order - La commande mise à jour
 * @param {string} previousStatus - L'ancien statut de la commande
 * @param {string} [type] - Type de notification (email, sms, both)
 */
const sendOrderStatusUpdateNotification = async (order, previousStatus, type = config.notifications.defaultType) => {
  if (!config.notifications.enabled) {
    logger.info('Notifications désactivées. Notification de mise à jour de statut non envoyée.');
    return { success: false, message: 'Notifications désactivées' };
  }

  try {
    // Récupérer les détails complets de la commande et de l'utilisateur
    const orderWithDetails = await order
      .populate('customer', 'nom prenom email telephone')
      .populate('pressing', 'nomCommerce')
      .execPopulate();

    // Envoyer une notification au client
    const result = await notificationService.sendNotification(
      orderWithDetails.customer,
      {
        type,
        template: 'orderStatusUpdate',
        data: {
          order: {
            reference: orderWithDetails._id,
            statut: orderWithDetails.statut,
          },
          previousStatus,
        },
      }
    );

    return { success: true, result };
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de la notification de mise à jour de statut:', error);
    throw error;
  }
};

/**
 * Envoyer une notification de réinitialisation de mot de passe
 * @param {Object} user - L'utilisateur concerné
 * @param {string} resetToken - Le token de réinitialisation
 * @param {string} [type] - Type de notification (email, sms, both)
 */
const sendPasswordResetNotification = async (user, resetToken, type = 'email') => {
  if (!config.notifications.enabled) {
    logger.info('Notifications désactivées. Notification de réinitialisation de mot de passe non envoyée.');
    return { success: false, message: 'Notifications désactivées' };
  }

  try {
    const result = await notificationService.sendNotification(
      user,
      {
        type,
        template: 'resetPassword',
        data: {
          resetToken,
        },
      }
    );

    return { success: true, result };
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de la notification de réinitialisation de mot de passe:', error);
    throw error;
  }
};

/**
 * Envoyer une notification personnalisée
 * @param {Object} user - L'utilisateur à notifier
 * @param {Object} options - Options de notification
 * @param {string} options.subject - Sujet de la notification
 * @param {string} options.message - Contenu du message
 * @param {string} [options.type] - Type de notification (email, sms, both)
 */
const sendCustomNotification = async (user, { subject, message, type = config.notifications.defaultType }) => {
  if (!config.notifications.enabled) {
    logger.info('Notifications désactivées. Notification personnalisée non envoyée.');
    return { success: false, message: 'Notifications désactivées' };
  }

  try {
    const result = await notificationService.sendNotification(
      user,
      {
        type,
        smsMessage: message,
        data: {
          subject,
          message,
        },
      }
    );

    return { success: true, result };
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de la notification personnalisée:', error);
    throw error;
  }
};

/**
 * Récupérer les notifications d'un utilisateur
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Middleware suivant
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.query.userId || req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Filtres optionnels
    const filters = { user: userId };
    if (req.query.type) {
      filters.type = req.query.type;
    }
    if (req.query.isRead !== undefined) {
      filters.isRead = req.query.isRead === 'true';
    }
    if (req.query.priority) {
      filters.priority = parseInt(req.query.priority);
    }

    // Récupérer les notifications avec pagination
    const notifications = await Notification.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'nom prenom email')
      .lean();

    // Compter le total pour la pagination
    const total = await Notification.countDocuments(filters);
    const totalPages = Math.ceil(total / limit);

    // Statistiques rapides
    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false
    });

    logger.info(`Notifications récupérées pour l'utilisateur ${userId}: ${notifications.length}`);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        stats: {
          unreadCount,
          totalCount: total
        }
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  sendWelcomeNotification,
  sendNewOrderNotification,
  sendOrderStatusUpdateNotification,
  sendPasswordResetNotification,
  sendCustomNotification,
  getNotifications,
};
