const express = require('express');
const router = express.Router();
const {
  getClientStats,
  exportStatsPDF,
  exportDataJSON,
  cleanupPDFs
} = require('../controllers/clientStats.controller');
const { protect: authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     ClientStats:
 *       type: object
 *       properties:
 *         totalOrders:
 *           type: integer
 *           description: Nombre total de commandes
 *         completedOrders:
 *           type: integer
 *           description: Nombre de commandes livrées
 *         cancelledOrders:
 *           type: integer
 *           description: Nombre de commandes annulées
 *         totalSpent:
 *           type: number
 *           description: Montant total dépensé
 *         averageOrderValue:
 *           type: number
 *           description: Valeur moyenne des commandes
 *         averageRating:
 *           type: number
 *           description: Note moyenne donnée
 *         satisfactionRate:
 *           type: integer
 *           description: Taux de satisfaction en pourcentage
 *         favoritePressing:
 *           type: string
 *           description: Pressing favori
 *         topPressings:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               orderCount:
 *                 type: integer
 *               averageRating:
 *                 type: number
 *         monthlyOrders:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               count:
 *                 type: integer
 */

/**
 * @swagger
 * /api/v1/clients/stats:
 *   get:
 *     summary: Récupère les statistiques personnelles du client connecté
 *     tags: [Client Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   $ref: '#/components/schemas/ClientStats'
 *                 ordersCount:
 *                   type: integer
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats', authenticate, getClientStats);

/**
 * @swagger
 * /api/v1/clients/export-stats-pdf:
 *   post:
 *     summary: Génère et télécharge un PDF des statistiques personnelles
 *     tags: [Client Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF généré avec succès
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Client non trouvé
 *       500:
 *         description: Erreur lors de la génération du PDF
 */
router.post('/export-stats-pdf', authenticate, exportStatsPDF);

/**
 * @swagger
 * /api/v1/clients/export-data-json:
 *   get:
 *     summary: Exporte toutes les données du client en JSON
 *     tags: [Client Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Données exportées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 client:
 *                   type: object
 *                   description: Données du client
 *                 statistics:
 *                   $ref: '#/components/schemas/ClientStats'
 *                 orders:
 *                   type: array
 *                   description: Historique des commandes
 *                 exportDate:
 *                   type: string
 *                   format: date-time
 *                 totalRecords:
 *                   type: object
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Client non trouvé
 *       500:
 *         description: Erreur lors de l'export
 */
router.get('/export-data-json', authenticate, exportDataJSON);

/**
 * @swagger
 * /api/v1/clients/cleanup-pdfs:
 *   post:
 *     summary: Nettoie les anciens fichiers PDF temporaires (Admin seulement)
 *     tags: [Client Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nettoyage effectué avec succès
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur lors du nettoyage
 */
router.post('/cleanup-pdfs', authenticate, cleanupPDFs);

module.exports = router;
