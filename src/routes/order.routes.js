const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Orders
 *     description: Gestion des commandes de pressing
 *   - name: Recurring Orders
 *     description: Gestion des commandes récurrentes
 */

// Toutes les routes sont protégées
router.use(protect);

// Routes unifiées pour les commandes
router.get('/', authorize('client', 'pressing', 'admin'), orderController.getOrders);
router.get('/:id', authorize('client', 'pressing', 'admin'), orderController.getOrder);
router.get('/:id/tracking', authorize('client', 'pressing', 'admin'), orderController.getOrderTracking);
router.post('/', authorize('client'), orderController.createOrder);
router.patch('/:id/status', authorize('pressing', 'admin'), orderController.updateOrderStatus);

// Actions spécifiques au client
router.put('/:id/annuler', authorize('client'), orderController.cancelOrder);
router.post('/:id/noter', authorize('client'), orderController.reviewOrder);

// Routes pour les commandes récurrentes (clients uniquement)
router.post('/recurrentes', authorize('client'), orderController.createRecurringOrder);
router.get('/recurrentes', authorize('client'), orderController.getRecurringOrders);
router.put('/recurrentes/:id', authorize('client'), orderController.updateRecurringOrder);
router.delete('/recurrentes/:id', authorize('client'), orderController.deactivateRecurringOrder);

module.exports = router;
