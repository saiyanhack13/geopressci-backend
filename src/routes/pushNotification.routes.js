const express = require('express');
const {
  subscribe,
  unsubscribe,
  sendTestNotification,
  sendCustomNotification,
  getSubscriptionStats,
  cleanupSubscriptions,
  sendTemplateNotification
} = require('../controllers/pushNotification.controller');

const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, query, param } = require('express-validator');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * @swagger
 * /push/subscribe:
 *   post:
 *     summary: S'abonner aux notifications push
 *     description: Enregistre une subscription push pour l'utilisateur connecté
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription
 *             properties:
 *               subscription:
 *                 type: object
 *                 required:
 *                   - endpoint
 *                   - keys
 *                 properties:
 *                   endpoint:
 *                     type: string
 *                     description: Endpoint de la subscription push
 *                   keys:
 *                     type: object
 *                     required:
 *                       - p256dh
 *                       - auth
 *                     properties:
 *                       p256dh:
 *                         type: string
 *                         description: Clé publique P256DH
 *                       auth:
 *                         type: string
 *                         description: Clé d'authentification
 *     responses:
 *       201:
 *         description: Subscription enregistrée avec succès
 *       400:
 *         description: Données de subscription invalides
 *       401:
 *         description: Non authentifié
 */
router.post('/subscribe', [
  body('subscription').notEmpty().withMessage('Subscription requise'),
  body('subscription.endpoint').isURL().withMessage('Endpoint invalide'),
  body('subscription.keys.p256dh').notEmpty().withMessage('Clé p256dh requise'),
  body('subscription.keys.auth').notEmpty().withMessage('Clé auth requise'),
  validate
], subscribe);

/**
 * @swagger
 * /push/unsubscribe:
 *   delete:
 *     summary: Se désabonner des notifications push
 *     description: Supprime une subscription push
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *             properties:
 *               endpoint:
 *                 type: string
 *                 description: Endpoint de la subscription à supprimer
 *     responses:
 *       200:
 *         description: Subscription supprimée avec succès
 *       400:
 *         description: Endpoint requis
 *       404:
 *         description: Subscription non trouvée
 */
router.delete('/unsubscribe', [
  body('endpoint').isURL().withMessage('Endpoint invalide'),
  validate
], unsubscribe);

/**
 * @swagger
 * /push/test:
 *   post:
 *     summary: Envoyer une notification de test
 *     description: Envoie une notification push de test à l'utilisateur connecté
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Titre de la notification
 *               body:
 *                 type: string
 *                 description: Contenu de la notification
 *               data:
 *                 type: object
 *                 description: Données supplémentaires
 *     responses:
 *       200:
 *         description: Notification de test envoyée
 *       400:
 *         description: Échec de l'envoi
 */
router.post('/test', sendTestNotification);

/**
 * @swagger
 * /push/send:
 *   post:
 *     summary: Envoyer une notification personnalisée (Admin)
 *     description: Permet aux administrateurs d'envoyer des notifications push personnalisées
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *               - title
 *               - body
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Liste des IDs utilisateurs destinataires
 *               title:
 *                 type: string
 *                 description: Titre de la notification
 *               body:
 *                 type: string
 *                 description: Contenu de la notification
 *               data:
 *                 type: object
 *                 description: Données supplémentaires
 *               options:
 *                 type: object
 *                 properties:
 *                   ttl:
 *                     type: integer
 *                     description: Durée de vie en secondes
 *                   urgency:
 *                     type: string
 *                     enum: [very-low, low, normal, high]
 *                     description: Urgence de la notification
 *     responses:
 *       200:
 *         description: Notifications envoyées
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Accès refusé (Admin uniquement)
 */
router.post('/send', [
  authorize('admin'),
  body('userIds').isArray({ min: 1 }).withMessage('Liste d\'utilisateurs requise'),
  body('title').notEmpty().withMessage('Titre requis'),
  body('body').notEmpty().withMessage('Contenu requis'),
  validate
], sendCustomNotification);

/**
 * @swagger
 * /push/template/{templateName}:
 *   post:
 *     summary: Envoyer une notification basée sur un template
 *     description: Envoie une notification push en utilisant un template prédéfini
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [newOrder, orderStatusUpdate, paymentReceived, newReview, promotionAlert]
 *         description: Nom du template à utiliser
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID de l'utilisateur destinataire (optionnel, par défaut l'utilisateur connecté)
 *               data:
 *                 type: object
 *                 description: Données pour le template
 *               options:
 *                 type: object
 *                 description: Options d'envoi
 *     responses:
 *       200:
 *         description: Notification template envoyée
 *       400:
 *         description: Template invalide ou échec d'envoi
 *       403:
 *         description: Permissions insuffisantes
 */
router.post('/template/:templateName', [
  param('templateName').isIn(['newOrder', 'orderStatusUpdate', 'paymentReceived', 'newReview', 'promotionAlert'])
    .withMessage('Template invalide'),
  validate
], sendTemplateNotification);

/**
 * @swagger
 * /push/stats:
 *   get:
 *     summary: Obtenir les statistiques des subscriptions (Admin)
 *     description: Récupère les statistiques des subscriptions push
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques récupérées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     inactive:
 *                       type: integer
 *                     byUserType:
 *                       type: object
 *       403:
 *         description: Accès refusé (Admin uniquement)
 */
router.get('/stats', authorize('admin'), getSubscriptionStats);

/**
 * @swagger
 * /push/cleanup:
 *   delete:
 *     summary: Nettoyer les subscriptions inactives (Admin)
 *     description: Supprime les subscriptions push inactives
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: daysOld
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Nombre de jours d'inactivité avant suppression
 *     responses:
 *       200:
 *         description: Nettoyage effectué
 *       403:
 *         description: Accès refusé (Admin uniquement)
 */
router.delete('/cleanup', [
  authorize('admin'),
  query('daysOld').optional().isInt({ min: 1 }).withMessage('Nombre de jours invalide')
], cleanupSubscriptions);

module.exports = router;
