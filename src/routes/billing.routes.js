const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { requireActiveSubscription, requireIdentityVerification } = require('../middleware/subscription');
const billingController = require('../controllers/billing.controller');

/**
 * @swagger
 * tags:
 *   name: Billing
 *   description: Gestion de la facturation et des abonnements
 */

// Toutes les routes sont protégées et nécessitent une authentification
router.use(protect);

/**
 * @swagger
 * /api/v1/billing/history:
 *   get:
 *     summary: Obtenir l'historique des paiements
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historique des paiements récupéré avec succès
 *       401:
 *         description: Non autorisé
 */
router.get('/history', authorize('pressing'), billingController.getBillingHistory);

/**
 * @swagger
 * /api/v1/billing/payment-method:
 *   put:
 *     summary: Mettre à jour la méthode de paiement
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethodId
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 description: 'ID de la méthode de paiement (ex: ID de carte Stripe)'
 *               cardDetails:
 *                 type: object
 *                 properties:
 *                   last4:
 *                     type: string
 *                   brand:
 *                     type: string
 *                   expMonth:
 *                     type: number
 *                   expYear:
 *                     type: number
 *     responses:
 *       200:
 *         description: Méthode de paiement mise à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 */
router.put('/payment-method', authorize('pressing'), billingController.updatePaymentMethod);

/**
 * @swagger
 * /api/v1/billing/cancel-subscription:
 *   post:
 *     summary: Annuler l'abonnement
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Raison de l'annulation
 *     responses:
 *       200:
 *         description: Abonnement annulé avec succès
 *       400:
 *         description: Aucun abonnement actif trouvé
 *       401:
 *         description: Non autorisé
 */
router.post('/cancel-subscription', authorize('pressing'), requireIdentityVerification, billingController.cancelSubscription);

/**
 * @swagger
 * /api/v1/billing/resume-subscription:
 *   post:
 *     summary: Reprendre un abonnement annulé
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Abonnement repris avec succès
 *       400:
 *         description: Aucun abonnement annulé trouvé
 *       401:
 *         description: Non autorisé
 */
router.post('/resume-subscription', authorize('pressing'), requireIdentityVerification, billingController.resumeSubscription);

/**
 * @swagger
 * /api/v1/billing/change-plan:
 *   post:
 *     summary: Changer de forfait d'abonnement
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPlan
 *             properties:
 *               newPlan:
 *                 type: string
 *                 enum: [essai, mensuel, annuel]
 *                 description: Nouveau forfait d'abonnement
 *     responses:
 *       200:
 *         description: Forfait changé avec succès
 *       400:
 *         description: Données invalides ou forfait identique
 *       401:
 *         description: Non autorisé
 */
router.post('/change-plan', authorize('pressing'), requireIdentityVerification, requireActiveSubscription, billingController.changeSubscriptionPlan);

/**
 * @swagger
 * /api/v1/billing/invoices/{invoiceId}:
 *   get:
 *     summary: Obtenir une facture au format PDF
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la facture
 *     responses:
 *       200:
 *         description: Fichier PDF de la facture
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Facture non trouvée
 *       401:
 *         description: Non autorisé
 */
router.get('/invoices/:invoiceId', authorize('pressing'), billingController.getInvoice);

module.exports = router;
