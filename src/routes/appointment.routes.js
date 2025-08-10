const express = require('express');
const { body, param, query } = require('express-validator');
const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
  completeAppointment,
  getAppointmentStats
} = require('../controllers/appointment.controller');
const { protect: authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Appointment:
 *       type: object
 *       required:
 *         - client
 *         - pressing
 *         - timeSlot
 *         - services
 *       properties:
 *         _id:
 *           type: string
 *           description: ID unique du rendez-vous
 *         client:
 *           type: string
 *           description: ID du client
 *         pressing:
 *           type: string
 *           description: ID du pressing
 *         timeSlot:
 *           type: string
 *           description: ID du créneau horaire
 *         order:
 *           type: string
 *           description: ID de la commande associée
 *         services:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               service:
 *                 type: string
 *                 description: ID du service
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               unitPrice:
 *                 type: number
 *                 minimum: 0
 *               totalPrice:
 *                 type: number
 *                 minimum: 0
 *         status:
 *           type: string
 *           enum: [pending, confirmed, in_progress, completed, cancelled, no_show]
 *           description: Statut du rendez-vous
 *         appointmentDate:
 *           type: string
 *           format: date-time
 *           description: Date et heure du rendez-vous
 *         totalAmount:
 *           type: number
 *           minimum: 0
 *           description: Montant total
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, refunded]
 *           description: Statut du paiement
 *         notes:
 *           type: string
 *           description: Notes du client
 *         internalNotes:
 *           type: string
 *           description: Notes internes du pressing
 *         rating:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             comment:
 *               type: string
 *             date:
 *               type: string
 *               format: date-time
 */

/**
 * @swagger
 * /api/v1/appointments:
 *   post:
 *     summary: Créer un nouveau rendez-vous
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pressing
 *               - timeSlot
 *               - services
 *             properties:
 *               pressing:
 *                 type: string
 *                 description: ID du pressing
 *               timeSlot:
 *                 type: string
 *                 description: ID du créneau horaire
 *               services:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - service
 *                     - quantity
 *                   properties:
 *                     service:
 *                       type: string
 *                       description: ID du service
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Notes du client
 *               pickupAddress:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   coordinates:
 *                     type: object
 *                     properties:
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
 *               deliveryAddress:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   coordinates:
 *                     type: object
 *                     properties:
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
 *     responses:
 *       201:
 *         description: Rendez-vous créé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Pressing ou créneau non trouvé
 *       409:
 *         description: Créneau non disponible
 */
router.post('/appointments',
  authenticate,
  [
    body('pressing').isMongoId().withMessage('ID pressing invalide'),
    body('timeSlot').isMongoId().withMessage('ID créneau invalide'),
    body('services').isArray({ min: 1 }).withMessage('Au moins un service requis'),
    body('services.*.service').isMongoId().withMessage('ID service invalide'),
    body('services.*.quantity').isInt({ min: 1 }).withMessage('Quantité invalide'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes trop longues (max 500 caractères)'),
    body('pickupAddress.street').optional().isString().withMessage('Adresse de collecte invalide'),
    body('pickupAddress.city').optional().isString().withMessage('Ville de collecte invalide'),
    body('pickupAddress.coordinates.latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
    body('pickupAddress.coordinates.longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide'),
    body('deliveryAddress.street').optional().isString().withMessage('Adresse de livraison invalide'),
    body('deliveryAddress.city').optional().isString().withMessage('Ville de livraison invalide'),
    body('deliveryAddress.coordinates.latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
    body('deliveryAddress.coordinates.longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide')
  ],
  createAppointment
);

/**
 * @swagger
 * /api/v1/appointments:
 *   get:
 *     summary: Récupérer les rendez-vous
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, in_progress, completed, cancelled, no_show]
 *         description: Filtrer par statut
 *       - in: query
 *         name: pressing
 *         schema:
 *           type: string
 *         description: Filtrer par pressing (ID)
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *         description: Filtrer par client (ID)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début de la période
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin de la période
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [appointmentDate, createdAt, status, totalAmount]
 *           default: appointmentDate
 *         description: Champ de tri
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Ordre de tri
 *     responses:
 *       200:
 *         description: Rendez-vous récupérés avec succès
 *       400:
 *         description: Paramètres invalides
 *       401:
 *         description: Non authentifié
 */
router.get('/appointments',
  authenticate,
  [
    query('status').optional().isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).withMessage('Statut invalide'),
    query('pressing').optional().isMongoId().withMessage('ID pressing invalide'),
    query('client').optional().isMongoId().withMessage('ID client invalide'),
    query('startDate').optional().isISO8601().withMessage('Date de début invalide'),
    query('endDate').optional().isISO8601().withMessage('Date de fin invalide'),
    query('page').optional().isInt({ min: 1 }).withMessage('Numéro de page invalide'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite invalide (1-100)'),
    query('sortBy').optional().isIn(['appointmentDate', 'createdAt', 'status', 'totalAmount']).withMessage('Champ de tri invalide'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Ordre de tri invalide')
  ],
  getAppointments
);

/**
 * @swagger
 * /api/v1/appointments/{appointmentId}:
 *   get:
 *     summary: Récupérer un rendez-vous par ID
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du rendez-vous
 *     responses:
 *       200:
 *         description: Rendez-vous récupéré avec succès
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Rendez-vous non trouvé
 */
router.get('/appointments/:appointmentId',
  authenticate,
  [
    param('appointmentId').isMongoId().withMessage('ID rendez-vous invalide')
  ],
  getAppointmentById
);

/**
 * @swagger
 * /api/v1/appointments/{appointmentId}/confirm:
 *   patch:
 *     summary: Confirmer un rendez-vous
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du rendez-vous
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estimatedDuration:
 *                 type: integer
 *                 minimum: 15
 *                 description: Durée estimée en minutes
 *               specialInstructions:
 *                 type: string
 *                 maxLength: 300
 *                 description: Instructions spéciales
 *               internalNotes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Notes internes
 *     responses:
 *       200:
 *         description: Rendez-vous confirmé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Rendez-vous non trouvé
 *       409:
 *         description: Rendez-vous ne peut pas être confirmé
 */
router.patch('/appointments/:appointmentId/confirm',
  authenticate,
  authorize('pressing', 'admin'),
  [
    param('appointmentId').isMongoId().withMessage('ID rendez-vous invalide'),
    body('estimatedDuration').optional().isInt({ min: 15 }).withMessage('Durée estimée invalide (minimum 15 minutes)'),
    body('specialInstructions').optional().isLength({ max: 300 }).withMessage('Instructions trop longues (max 300 caractères)'),
    body('internalNotes').optional().isLength({ max: 500 }).withMessage('Notes internes trop longues (max 500 caractères)')
  ],
  confirmAppointment
);

/**
 * @swagger
 * /api/v1/appointments/{appointmentId}/cancel:
 *   patch:
 *     summary: Annuler un rendez-vous
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du rendez-vous
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 300
 *                 description: Raison de l'annulation
 *               refundRequested:
 *                 type: boolean
 *                 default: false
 *                 description: Demande de remboursement
 *     responses:
 *       200:
 *         description: Rendez-vous annulé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Rendez-vous non trouvé
 *       409:
 *         description: Rendez-vous ne peut pas être annulé
 */
router.patch('/appointments/:appointmentId/cancel',
  authenticate,
  [
    param('appointmentId').isMongoId().withMessage('ID rendez-vous invalide'),
    body('reason').isLength({ min: 10, max: 300 }).withMessage('Raison requise (10-300 caractères)'),
    body('refundRequested').optional().isBoolean().withMessage('refundRequested doit être un booléen')
  ],
  cancelAppointment
);

/**
 * @swagger
 * /api/v1/appointments/{appointmentId}/reschedule:
 *   patch:
 *     summary: Reporter un rendez-vous
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du rendez-vous
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newTimeSlot
 *             properties:
 *               newTimeSlot:
 *                 type: string
 *                 description: ID du nouveau créneau horaire
 *               reason:
 *                 type: string
 *                 maxLength: 300
 *                 description: Raison du report
 *     responses:
 *       200:
 *         description: Rendez-vous reporté avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Rendez-vous ou nouveau créneau non trouvé
 *       409:
 *         description: Nouveau créneau non disponible
 */
router.patch('/appointments/:appointmentId/reschedule',
  authenticate,
  [
    param('appointmentId').isMongoId().withMessage('ID rendez-vous invalide'),
    body('newTimeSlot').isMongoId().withMessage('ID nouveau créneau invalide'),
    body('reason').optional().isLength({ max: 300 }).withMessage('Raison trop longue (max 300 caractères)')
  ],
  rescheduleAppointment
);

/**
 * @swagger
 * /api/v1/appointments/{appointmentId}/complete:
 *   patch:
 *     summary: Marquer un rendez-vous comme terminé
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du rendez-vous
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actualDuration:
 *                 type: integer
 *                 minimum: 5
 *                 description: Durée réelle en minutes
 *               qualityNotes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Notes sur la qualité du service
 *               completionPhotos:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: URLs des photos de fin de service
 *               nextAppointmentSuggested:
 *                 type: boolean
 *                 default: false
 *                 description: Suggérer un prochain rendez-vous
 *     responses:
 *       200:
 *         description: Rendez-vous terminé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Rendez-vous non trouvé
 *       409:
 *         description: Rendez-vous ne peut pas être terminé
 */
router.patch('/appointments/:appointmentId/complete',
  authenticate,
  authorize('pressing', 'admin'),
  [
    param('appointmentId').isMongoId().withMessage('ID rendez-vous invalide'),
    body('actualDuration').optional().isInt({ min: 5 }).withMessage('Durée réelle invalide (minimum 5 minutes)'),
    body('qualityNotes').optional().isLength({ max: 500 }).withMessage('Notes qualité trop longues (max 500 caractères)'),
    body('completionPhotos').optional().isArray().withMessage('Photos de fin doivent être un tableau'),
    body('completionPhotos.*').optional().isURL().withMessage('URL photo invalide'),
    body('nextAppointmentSuggested').optional().isBoolean().withMessage('nextAppointmentSuggested doit être un booléen')
  ],
  completeAppointment
);

/**
 * @swagger
 * /api/v1/appointments/stats:
 *   get:
 *     summary: Obtenir les statistiques des rendez-vous
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pressing
 *         schema:
 *           type: string
 *         description: ID du pressing (requis pour les pressings)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début de la période
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin de la période
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Groupement des statistiques
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *       400:
 *         description: Paramètres invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 */
router.get('/appointments/stats',
  authenticate,
  [
    query('pressing').optional().isMongoId().withMessage('ID pressing invalide'),
    query('startDate').optional().isISO8601().withMessage('Date de début invalide'),
    query('endDate').optional().isISO8601().withMessage('Date de fin invalide'),
    query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('Groupement invalide')
  ],
  getAppointmentStats
);

module.exports = router;
