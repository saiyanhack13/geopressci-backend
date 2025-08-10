const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const paymentController = require('../controllers/payment.controller');

// Toutes les routes sont protégées et réservées aux clients ou admins
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Gestion des paiements des commandes
 */

// Toutes les routes sont protégées et nécessitent une authentification client
router.use(protect, authorize('client'));

/**
 * @swagger
 * /api/v1/payments/initiate:
 *   post:
 *     summary: Initier un paiement pour une commande
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - commandeId
 *               - paymentMethod
 *             properties:
 *               commandeId:
 *                 type: string
 *                 description: ID de la commande à payer
 *               paymentMethod:
 *                 type: string
 *                 enum: [orangemoney, mtnmomo, moovmoney, wave, card]
 *                 description: Méthode de paiement choisie
 *               phoneNumber:
 *                 type: string
 *                 description: Numéro de téléphone pour les paiements Mobile Money
 *     responses:
 *       200:
 *         description: Paiement initié avec succès, en attente de confirmation
 *       400:
 *         description: Données invalides ou commande non payable
 *       401:
 *         description: Non autorisé
 */
router.post('/initiate', paymentController.initiatePayment);

/**
 * @swagger
 * /api/v1/payments/{transactionId}/status:
 *   get:
 *     summary: Vérifier le statut d'un paiement
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la transaction de paiement
 *     responses:
 *       200:
 *         description: Statut du paiement récupéré avec succès
 *       404:
 *         description: Transaction non trouvée
 *       401:
 *         description: Non autorisé
 */
router.get('/:transactionId/status', paymentController.getPaymentStatus);

/**
 * @swagger
 * /api/v1/payments/verify:
 *   post:
 *     summary: Vérifier un paiement Mobile Money
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - provider
 *             properties:
 *               transactionId:
 *                 type: string
 *                 description: ID de la transaction à vérifier
 *               provider:
 *                 type: string
 *                 enum: [orangemoney, mtnmomo, moovmoney, wave]
 *                 description: Fournisseur Mobile Money
 *     responses:
 *       200:
 *         description: Paiement vérifié avec succès
 *       400:
 *         description: Vérification échouée
 *       404:
 *         description: Transaction non trouvée
 */
router.post('/verify', protect, authorize('client'), paymentController.verifyPayment);

/**
 * @swagger
 * /api/v1/payments/webhook:
 *   post:
 *     summary: Webhook pour les notifications des opérateurs Mobile Money
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactionId:
 *                 type: string
 *               status:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               provider:
 *                 type: string
 *               signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook traité avec succès
 */
router.post('/webhook', paymentController.handleWebhook);

/**
 * @swagger
 * /api/v1/payments/methods:
 *   get:
 *     summary: Récupérer les méthodes de paiement disponibles
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Liste des méthodes de paiement
 */
router.get('/methods', paymentController.getPaymentMethods);

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Récupérer l'historique des paiements de l'utilisateur ou de tous les utilisateurs (admin)
 *     tags: [Paiements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, success, failed, cancelled]
 *         description: Filtrer par statut de paiement
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Nombre d'éléments par page
 *     responses:
 *       200:
 *         description: Historique des paiements
 *       401:
 *         description: Non autorisé
 */
router.get('/', protect, authorize('client', 'admin'), paymentController.getPaymentHistory);

// Routes pour les transactions (alias pour les paiements avec plus de détails)
/**
 * @swagger
 * /api/v1/transactions:
 *   get:
 *     summary: Récupérer l'historique des transactions avec statistiques
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, succeeded, failed, canceled]
 *         description: Filtrer par statut
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [orangemoney, mtnmomo, moovmoney, wave]
 *         description: Filtrer par fournisseur
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Nombre d'éléments par page
 *     responses:
 *       200:
 *         description: Historique des transactions avec statistiques
 *       401:
 *         description: Non autorisé
 */
router.get('/transactions', protect, authorize('client', 'admin'), paymentController.getTransactions);

/**
 * @swagger
 * /api/v1/transactions/{id}:
 *   get:
 *     summary: Récupérer le détail d'une transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la transaction
 *     responses:
 *       200:
 *         description: Détail de la transaction
 *       404:
 *         description: Transaction non trouvée
 *       401:
 *         description: Non autorisé
 */
router.get('/transactions/:id', protect, authorize('client', 'admin'), paymentController.getTransactionById);

module.exports = router;
