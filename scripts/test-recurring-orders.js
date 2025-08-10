const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('../src/models/order.model');
const recurringOrderService = require('../src/services/recurringOrder.service');
const { connectDB } = require('../src/config/database');
const logger = require('../src/utils/logger');

// Charger les variables d'environnement
dotenv.config();

// Fonction pour simuler une commande de test
const createTestOrder = async (userId, pressingId) => {
  const order = new Order({
    orderNumber: `TEST-${Date.now()}`,
    customer: userId,
    pressing: pressingId,
    items: [
      {
        service: new mongoose.Types.ObjectId(),
        serviceDetails: {
          name: 'Nettoyage à sec - Costume',
          price: 5000,
          category: 'Nettoyage à sec',
          duration: 24
        },
        quantity: 1,
        unitPrice: 5000,
        status: 'pending'
      }
    ],
    status: 'pending',
    totalAmount: 5000,
    paymentStatus: 'paid',
    deliveryAddress: '123 Rue de Test, Abidjan, Côte d\'Ivoire',
    deliveryType: 'pickup',
    metadata: {
      test: true
    }
  });

  await order.save();
  return order;
};

// Fonction principale de test
const testRecurringOrders = async () => {
  try {
    // Se connecter à la base de données
    await connectDB();
    logger.info('Connecté à la base de données');

    // Créer des IDs de test
    const testUserId = new mongoose.Types.ObjectId();
    const testPressingId = new mongoose.Types.ObjectId();

    // 1. Tester la création d'une commande de test
    logger.info('Création d\'une commande de test...');
    const testOrder = await createTestOrder(testUserId, testPressingId);
    logger.info(`Commande de test créée avec l'ID: ${testOrder._id}`);

    // 2. Tester la création d'une commande récurrente
    logger.info('Création d\'une commande récurrente...');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Demain
    
    const recurringOrder = await recurringOrderService.createRecurringOrder(
      testOrder._id,
      {
        frequency: 'monthly',
        startDate,
        occurrences: 3,
        userId: testUserId
      }
    );
    
    logger.info(`Commande récurrente créée avec l'ID: ${recurringOrder._id}`);
    logger.info('Détails de la commande récurrente:', JSON.stringify({
      id: recurringOrder._id,
      frequency: recurringOrder.metadata.recurring.frequency,
      nextOccurrence: recurringOrder.metadata.recurring.nextOccurrence,
      isActive: recurringOrder.metadata.recurring.isActive,
      occurrences: recurringOrder.metadata.recurring.occurrenceCount,
      maxOccurrences: recurringOrder.metadata.recurring.maxOccurrences
    }, null, 2));

    // 3. Tester la récupération des commandes récurrentes de l'utilisateur
    logger.info('Récupération des commandes récurrentes...');
    const userRecurringOrders = await recurringOrderService.getUserRecurringOrders(testUserId);
    logger.info(`Nombre de commandes récurrentes trouvées: ${userRecurringOrders.length}`);

    if (userRecurringOrders.length > 0) {
      logger.info('Détails de la première commande récurrente:', JSON.stringify({
        id: userRecurringOrders[0]._id,
        frequency: userRecurringOrders[0].metadata.recurring.frequency,
        nextOccurrence: userRecurringOrders[0].metadata.recurring.nextOccurrence,
        isActive: userRecurringOrders[0].metadata.recurring.isActive
      }, null, 2));
    }

    // 4. Tester la mise à jour d'une commande récurrente
    if (userRecurringOrders.length > 0) {
      const orderId = userRecurringOrders[0]._id;
      const newEndDate = new Date();
      newEndDate.setMonth(newEndDate.getMonth() + 6); // 6 mois plus tard
      
      logger.info(`Mise à jour de la commande récurrente ${orderId}...`);
      const updatedOrder = await recurringOrderService.updateRecurringOrder(
        orderId,
        { 
          frequency: 'biweekly',
          endDate: newEndDate
        }
      );
      
      logger.info('Commande récurrente mise à jour avec succès:', JSON.stringify({
        id: updatedOrder._id,
        frequency: updatedOrder.metadata.recurring.frequency,
        nextOccurrence: updatedOrder.metadata.recurring.nextOccurrence,
        endDate: updatedOrder.metadata.recurring.endDate,
        isActive: updatedOrder.metadata.recurring.isActive
      }, null, 2));
    }

    // 5. Tester la désactivation d'une commande récurrente
    if (userRecurringOrders.length > 0) {
      const orderId = userRecurringOrders[0]._id;
      
      logger.info(`Désactivation de la commande récurrente ${orderId}...`);
      await recurringOrderService.deactivateRecurringOrder(orderId);
      
      const deactivatedOrder = await Order.findById(orderId);
      logger.info('Commande récurrente désactivée avec succès:', JSON.stringify({
        id: deactivatedOrder._id,
        isActive: deactivatedOrder.metadata.recurring.isActive,
        deactivatedAt: deactivatedOrder.metadata.recurring.deactivatedAt
      }, null, 2));
    }

    logger.info('Tous les tests ont été exécutés avec succès!');
    
  } catch (error) {
    logger.error('Erreur lors de l\'exécution des tests:', error);
  } finally {
    // Fermer la connexion à la base de données
    await mongoose.connection.close();
    logger.info('Connexion à la base de données fermée');
    process.exit(0);
  }
};

// Exécuter le test
testRecurringOrders();
