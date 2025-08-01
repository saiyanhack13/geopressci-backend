const Order = require('../models/order.model');
const logger = require('../utils/logger');
const { ErrorResponse, BadRequestError } = require('../utils/error.utils');
const notificationService = require('./notification.service');
const agenda = require('../config/agenda');

/**
 * Service pour gérer les commandes récurrentes
 */
class RecurringOrderService {
  constructor() {
    // Temporarily disabled to allow server startup
    // this.setupAgendaJobs();
  }

  /**
   * Configure les tâches planifiées pour les commandes récurrentes
   */
  setupAgendaJobs() {
    // Planifier la vérification quotidienne des commandes récurrentes
    agenda.define('process-recurring-orders', async (job, done) => {
      try {
        await this.processDueRecurringOrders();
        done();
      } catch (error) {
        logger.error('Erreur lors du traitement des commandes récurrentes:', error);
        done(error);
      }
    });

    // Planifier l'exécution quotidienne à minuit
    agenda.every('1 day', 'process-recurring-orders', { timezone: 'Africa/Abidjan' });
  }

  /**
   * Crée une nouvelle commande récurrente basée sur une commande existante
   * @param {string} orderId - ID de la commande à dupliquer
   * @param {Object} options - Options de récurrence
   * @param {string} options.frequency - Fréquence de récurrence (daily, weekly, biweekly, monthly)
   * @param {Date} options.startDate - Date de début de la récurrence
   * @param {Date} [options.endDate] - Date de fin de la récurrence (optionnel)
   * @param {number} [options.occurrences] - Nombre d'occurrences (optionnel)
   * @returns {Promise<Object>} - Nouvelle commande récurrente créée
   */
  async createRecurringOrder(orderId, options = {}) {
    const { frequency = 'monthly', startDate = new Date(), endDate, occurrences } = options;
    
    // Valider la fréquence
    const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      throw new BadRequestError(`Fréquence non valide. Doit être l'un des suivants: ${validFrequencies.join(', ')}`);
    }

    // Vérifier que la date de début est dans le futur
    if (new Date(startDate) < new Date()) {
      throw new BadRequestError('La date de début doit être dans le futur');
    }

    // Vérifier que la date de fin est après la date de début si spécifiée
    if (endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestError('La date de fin doit être postérieure à la date de début');
    }

    // Récupérer la commande originale
    const originalOrder = await Order.findById(orderId);
    if (!originalOrder) {
      throw new Error('Commande originale non trouvée');
    }

    // Vérifier que l'utilisateur est le propriétaire de la commande
    if (originalOrder.customer.toString() !== options.userId) {
      throw new Error('Non autorisé à créer une commande récurrente à partir de cette commande');
    }

    // Créer la commande récurrente
    const recurringOrder = await Order.createRecurringOrder(orderId, {
      frequency,
      startDate,
      endDate,
      occurrences
    });

    // Planifier la prochaine occurrence
    await this.scheduleNextOccurrence(recurringOrder);

    // Envoyer une notification de confirmation
    await notificationService.sendRecurringOrderConfirmation(recurringOrder);

    return recurringOrder;
  }

  /**
   * Planifie la prochaine occurrence d'une commande récurrente
   * @param {Object} order - Commande récurrente
   * @returns {Promise<void>}
   */
  async scheduleNextOccurrence(order) {
    const { frequency, nextOccurrence } = order.metadata.recurring;
    
    // Vérifier si la date de la prochaine occurrence est dans le futur
    if (new Date(nextOccurrence) < new Date()) {
      logger.warn(`La date de la prochaine occurrence est dans le passé: ${nextOccurrence}`);
      return;
    }

    // Planifier la création de la prochaine commande
    agenda.schedule(nextOccurrence, 'create-next-recurring-order', {
      orderId: order._id,
      frequency
    });
  }

  /**
   * Traite les commandes récurrentes à créer
   * @returns {Promise<void>}
   */
  async processDueRecurringOrders() {
    logger.info('Début du traitement des commandes récurrentes...');
    
    // Trouver toutes les commandes récurrentes actives
    const recurringOrders = await Order.find({
      'metadata.recurring.isActive': true,
      'metadata.recurring.nextOccurrence': { $lte: new Date() }
    });

    logger.info(`Trouvé ${recurringOrders.length} commandes récurrentes à traiter`);

    // Traiter chaque commande récurrente
    for (const order of recurringOrders) {
      try {
        await this.processRecurringOrder(order);
      } catch (error) {
        logger.error(`Erreur lors du traitement de la commande récurrente ${order._id}:`, error);
        // Continuer avec la commande suivante en cas d'erreur
      }
    }
  }

  /**
   * Traite une commande récurrente
   * @param {Object} order - Commande récurrente à traiter
   * @returns {Promise<void>}
   */
  async processRecurringOrder(order) {
    const { recurring } = order.metadata;
    
    // Vérifier si la récurrence est toujours active
    if (!recurring.isActive) {
      logger.info(`La commande récurrente ${order._id} n'est plus active`);
      return;
    }

    // Vérifier si la date de fin est dépassée
    if (recurring.endDate && new Date(recurring.endDate) < new Date()) {
      logger.info(`La date de fin de la commande récurrente ${order._id} est dépassée`);
      await this.deactivateRecurringOrder(order._id);
      return;
    }

    // Vérifier si le nombre maximum d'occurrences est atteint
    if (recurring.maxOccurrences && recurring.occurrenceCount >= recurring.maxOccurrences) {
      logger.info(`Le nombre maximum d'occurrences a été atteint pour la commande récurrente ${order._id}`);
      await this.deactivateRecurringOrder(order._id);
      return;
    }

    try {
      // Créer une nouvelle commande basée sur la commande récurrente
      const newOrder = await Order.createRecurringOrder(order._id, {
        frequency: recurring.frequency
      });n
      // Mettre à jour le compteur d'occurrences
      await Order.findByIdAndUpdate(order._id, {
        $inc: { 'metadata.recurring.occurrenceCount': 1 },
        'metadata.recurring.lastProcessedAt': new Date(),
        'metadata.recurring.nextOccurrence': Order.calculateNextOccurrence(new Date(), recurring.frequency)
      });

      // Planifier la prochaine occurrence
      await this.scheduleNextOccurrence(order);

      // Envoyer une notification au client
      await notificationService.sendRecurringOrderProcessed(newOrder, order);

      logger.info(`Nouvelle commande récurrente créée: ${newOrder._id}`);
    } catch (error) {
      logger.error(`Erreur lors de la création d'une nouvelle commande récurrente:`, error);
      throw error;
    }
  }

  /**
   * Désactive une commande récurrente
   * @param {string} orderId - ID de la commande récurrente à désactiver
   * @returns {Promise<void>}
   */
  async deactivateRecurringOrder(orderId) {
    await Order.findByIdAndUpdate(orderId, {
      'metadata.recurring.isActive': false,
      'metadata.recurring.deactivatedAt': new Date()
    });

    logger.info(`Commande récurrente ${orderId} désactivée`);
  }

  /**
   * Récupère les commandes récurrentes d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} - Liste des commandes récurrentes
   */
  async getUserRecurringOrders(userId) {
    return Order.find({
      'customer': userId,
      'metadata.recurring.isActive': true
    }).sort({ 'metadata.recurring.nextOccurrence': 1 });
  }

  /**
   * Met à jour une commande récurrente
   * @param {string} orderId - ID de la commande récurrente
   * @param {Object} updates - Mises à jour à appliquer
   * @returns {Promise<Object>} - Commande mise à jour
   */
  async updateRecurringOrder(orderId, updates) {
    const allowedUpdates = ['frequency', 'endDate', 'isActive'];
    const updatesToApply = {};

    // Filtrer les mises à jour autorisées
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updatesToApply[`metadata.recurring.${key}`] = updates[key];
      }
    });

    // Si la fréquence a changé, recalculer la prochaine occurrence
    if (updates.frequency) {
      updatesToApply['metadata.recurring.nextOccurrence'] = 
        Order.calculateNextOccurrence(new Date(), updates.frequency);
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updatesToApply },
      { new: true, runValidators: true }
    );

    // Si la commande est réactivée, planifier la prochaine occurrence
    if (updates.isActive === true) {
      await this.scheduleNextOccurrence(updatedOrder);
    }

    return updatedOrder;
  }
}

module.exports = new RecurringOrderService();
