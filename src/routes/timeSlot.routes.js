const express = require('express');
const { body, param, query } = require('express-validator');
const {
  createTimeSlots,
  getAvailableSlots,
  updateTimeSlot,
  toggleBlockTimeSlot,
  deleteTimeSlot,
  getSlotStats,
  createBulkTimeSlots
} = require('../controllers/timeSlot.controller');
const { protect: authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     TimeSlot:
 *       type: object
 *       required:
 *         - pressing
 *         - date
 *         - startTime
 *         - endTime
 *         - maxCapacity
 *       properties:
 *         _id:
 *           type: string
 *           description: ID unique du créneau
 *         pressing:
 *           type: string
 *           description: ID du pressing
 *         date:
 *           type: string
 *           format: date
 *           description: Date du créneau
 *         startTime:
 *           type: string
 *           pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Heure de début (HH:MM)
 *         endTime:
 *           type: string
 *           pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Heure de fin (HH:MM)
 *         maxCapacity:
 *           type: integer
 *           minimum: 1
 *           description: Capacité maximale du créneau
 *         currentBookings:
 *           type: integer
 *           minimum: 0
 *           description: Nombre de réservations actuelles
 *         status:
 *           type: string
 *           enum: [available, full, blocked, closed]
 *           description: Statut du créneau
 *         slotType:
 *           type: string
 *           enum: [regular, express, premium, bulk]
 *           description: Type de créneau
 *         specialPrice:
 *           type: number
 *           minimum: 0
 *           description: Prix spécial pour ce créneau
 *         discount:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           description: Remise en pourcentage
 */

/**
 * @swagger
 * /api/v1/pressings/{pressingId}/time-slots:
 *   post:
 *     summary: Créer un nouveau créneau horaire
 *     tags: [TimeSlots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pressingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - startTime
 *               - endTime
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *               endTime:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *               maxCapacity:
 *                 type: integer
 *                 minimum: 1
 *                 default: 5
 *               slotType:
 *                 type: string
 *                 enum: [regular, express, premium, bulk]
 *                 default: regular
 *               specialPrice:
 *                 type: number
 *                 minimum: 0
 *               discount:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               availableServices:
 *                 type: array
 *                 items:
 *                   type: string
 *               recurrence:
 *                 type: object
 *                 properties:
 *                   isRecurring:
 *                     type: boolean
 *                   frequency:
 *                     type: string
 *                     enum: [daily, weekly, monthly]
 *                   endDate:
 *                     type: string
 *                     format: date
 *     responses:
 *       201:
 *         description: Créneau créé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       409:
 *         description: Créneau déjà existant
 */
router.post('/pressings/:pressingId/time-slots',
  authenticate,
  authorize('pressing', 'admin'),
  [
    param('pressingId').isMongoId().withMessage('ID pressing invalide'),
    body('date').isISO8601().withMessage('Date invalide'),
    body('startTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Heure de début invalide (format HH:MM)'),
    body('endTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Heure de fin invalide (format HH:MM)'),
    body('maxCapacity').optional().isInt({ min: 1 }).withMessage('Capacité maximale invalide'),
    body('slotType').optional().isIn(['regular', 'express', 'premium', 'bulk']).withMessage('Type de créneau invalide'),
    body('specialPrice').optional().isFloat({ min: 0 }).withMessage('Prix spécial invalide'),
    body('discount').optional().isFloat({ min: 0, max: 100 }).withMessage('Remise invalide (0-100%)'),
    body('availableServices').optional().isArray().withMessage('Services disponibles doivent être un tableau'),
    body('availableServices.*').optional().isMongoId().withMessage('ID service invalide'),
    body('recurrence.isRecurring').optional().isBoolean().withMessage('Récurrence invalide'),
    body('recurrence.frequency').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Fréquence de récurrence invalide'),
    body('recurrence.endDate').optional().isISO8601().withMessage('Date de fin de récurrence invalide')
  ],
  createTimeSlots
);

/**
 * @swagger
 * /api/v1/pressings/{pressingId}/available-slots:
 *   get:
 *     summary: Récupérer les créneaux disponibles d'un pressing
 *     tags: [TimeSlots]
 *     parameters:
 *       - in: path
 *         name: pressingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date spécifique (alternative à startDate/endDate)
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
 *         name: slotType
 *         schema:
 *           type: string
 *           enum: [regular, express, premium, bulk]
 *         description: Type de créneau à filtrer
 *       - in: query
 *         name: minCapacity
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Capacité minimale requise
 *       - in: query
 *         name: includeUnavailable
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Inclure les créneaux indisponibles
 *     responses:
 *       200:
 *         description: Créneaux récupérés avec succès
 *       400:
 *         description: Paramètres invalides
 *       404:
 *         description: Pressing non trouvé
 */
router.get('/pressings/:pressingId/available-slots',
  [
    param('pressingId').isMongoId().withMessage('ID pressing invalide'),
    query('date').optional().isISO8601().withMessage('Date invalide'),
    query('startDate').optional().isISO8601().withMessage('Date de début invalide'),
    query('endDate').optional().isISO8601().withMessage('Date de fin invalide'),
    query('slotType').optional().isIn(['regular', 'express', 'premium', 'bulk']).withMessage('Type de créneau invalide'),
    query('minCapacity').optional().isInt({ min: 1 }).withMessage('Capacité minimale invalide'),
    query('includeUnavailable').optional().isBoolean().withMessage('includeUnavailable doit être un booléen')
  ],
  getAvailableSlots
);

/**
 * @swagger
 * /api/v1/time-slots/{slotId}:
 *   put:
 *     summary: Mettre à jour un créneau horaire
 *     tags: [TimeSlots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du créneau
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxCapacity:
 *                 type: integer
 *                 minimum: 1
 *               specialPrice:
 *                 type: number
 *                 minimum: 0
 *               discount:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               availableServices:
 *                 type: array
 *                 items:
 *                   type: string
 *               internalNotes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Créneau mis à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Créneau non trouvé
 *       409:
 *         description: Modification impossible (réservations existantes)
 */
router.put('/time-slots/:slotId',
  authenticate,
  authorize('pressing', 'admin'),
  [
    param('slotId').isMongoId().withMessage('ID créneau invalide'),
    body('maxCapacity').optional().isInt({ min: 1 }).withMessage('Capacité maximale invalide'),
    body('specialPrice').optional().isFloat({ min: 0 }).withMessage('Prix spécial invalide'),
    body('discount').optional().isFloat({ min: 0, max: 100 }).withMessage('Remise invalide (0-100%)'),
    body('availableServices').optional().isArray().withMessage('Services disponibles doivent être un tableau'),
    body('availableServices.*').optional().isMongoId().withMessage('ID service invalide'),
    body('internalNotes').optional().isLength({ max: 500 }).withMessage('Notes internes trop longues (max 500 caractères)')
  ],
  updateTimeSlot
);

/**
 * @swagger
 * /api/v1/time-slots/{slotId}/toggle-block:
 *   patch:
 *     summary: Bloquer/débloquer un créneau
 *     tags: [TimeSlots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du créneau
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - blocked
 *             properties:
 *               blocked:
 *                 type: boolean
 *                 description: true pour bloquer, false pour débloquer
 *               reason:
 *                 type: string
 *                 description: Raison du blocage/déblocage
 *     responses:
 *       200:
 *         description: Créneau bloqué/débloqué avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Créneau non trouvé
 */
router.patch('/time-slots/:slotId/toggle-block',
  authenticate,
  authorize('pressing', 'admin'),
  [
    param('slotId').isMongoId().withMessage('ID créneau invalide'),
    body('blocked').isBoolean().withMessage('Le champ blocked est requis et doit être un booléen'),
    body('reason').optional().isString().withMessage('La raison doit être une chaîne de caractères')
  ],
  toggleBlockTimeSlot
);

/**
 * @swagger
 * /api/v1/time-slots/{slotId}:
 *   delete:
 *     summary: Supprimer un créneau horaire
 *     tags: [TimeSlots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du créneau
 *     responses:
 *       200:
 *         description: Créneau supprimé avec succès
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Créneau non trouvé
 *       409:
 *         description: Suppression impossible (réservations existantes)
 */
router.delete('/time-slots/:slotId',
  authenticate,
  authorize('pressing', 'admin'),
  [
    param('slotId').isMongoId().withMessage('ID créneau invalide')
  ],
  deleteTimeSlot
);

/**
 * @swagger
 * /api/v1/pressings/{pressingId}/slot-stats:
 *   get:
 *     summary: Obtenir les statistiques des créneaux d'un pressing
 *     tags: [TimeSlots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pressingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing
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
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Pressing non trouvé
 */
router.get('/pressings/:pressingId/slot-stats',
  authenticate,
  authorize('pressing', 'admin'),
  [
    param('pressingId').isMongoId().withMessage('ID pressing invalide'),
    query('startDate').optional().isISO8601().withMessage('Date de début invalide'),
    query('endDate').optional().isISO8601().withMessage('Date de fin invalide')
  ],
  getSlotStats
);

/**
 * @swagger
 * /api/v1/pressings/{pressingId}/bulk-time-slots:
 *   post:
 *     summary: Créer des créneaux en lot (template)
 *     tags: [TimeSlots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pressingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *               - timeSlots
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               timeSlots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - startTime
 *                     - endTime
 *                   properties:
 *                     startTime:
 *                       type: string
 *                       pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                     endTime:
 *                       type: string
 *                       pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                     maxCapacity:
 *                       type: integer
 *                       minimum: 1
 *                       default: 5
 *                     slotType:
 *                       type: string
 *                       enum: [regular, express, premium, bulk]
 *                       default: regular
 *               daysOfWeek:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *                 description: Jours de la semaine (0=Dimanche, 1=Lundi, etc.)
 *               skipExistingSlots:
 *                 type: boolean
 *                 default: true
 *                 description: Ignorer les créneaux existants
 *     responses:
 *       201:
 *         description: Créneaux créés avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Pressing non trouvé
 */
router.post('/pressings/:pressingId/bulk-time-slots',
  authenticate,
  authorize('pressing', 'admin'),
  [
    param('pressingId').isMongoId().withMessage('ID pressing invalide'),
    body('startDate').isISO8601().withMessage('Date de début invalide'),
    body('endDate').isISO8601().withMessage('Date de fin invalide'),
    body('timeSlots').isArray({ min: 1 }).withMessage('Au moins un créneau template requis'),
    body('timeSlots.*.startTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Heure de début invalide'),
    body('timeSlots.*.endTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Heure de fin invalide'),
    body('timeSlots.*.maxCapacity').optional().isInt({ min: 1 }).withMessage('Capacité maximale invalide'),
    body('timeSlots.*.slotType').optional().isIn(['regular', 'express', 'premium', 'bulk']).withMessage('Type de créneau invalide'),
    body('daysOfWeek').optional().isArray().withMessage('Jours de la semaine doivent être un tableau'),
    body('daysOfWeek.*').optional().isInt({ min: 0, max: 6 }).withMessage('Jour de la semaine invalide (0-6)'),
    body('skipExistingSlots').optional().isBoolean().withMessage('skipExistingSlots doit être un booléen')
  ],
  createBulkTimeSlots
);

module.exports = router;
