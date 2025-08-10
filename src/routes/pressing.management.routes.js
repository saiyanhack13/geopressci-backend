const express = require('express');
const router = express.Router();

// Import des contrôleurs
const {
  uploadGalleryPhoto,
  uploadProfilePhoto,
  uploadCoverPhoto,
  deleteGalleryPhoto,
  getPressingPhotos,
  setPrimaryPhoto
} = require('../controllers/pressing.photo.controller');

const {
  getMyServices,
  createService,
  updateService,
  deleteService,
  toggleServiceAvailability,
  getService
} = require('../controllers/pressing.services.controller');

const {
  getMyHours,
  updateDayHours,
  updateAllHours,
  copyHours,
  getCurrentStatus
} = require('../controllers/pressing.hours.controller');

// Import des middlewares
const { protect, authorize } = require('../middleware/auth.middleware');

// Appliquer la protection et l'autorisation à toutes les routes
router.use(protect);
router.use(authorize('pressing'));

// ===== ROUTES PHOTOS =====

/**
 * @swagger
 * /api/v1/pressing/photos:
 *   get:
 *     summary: Récupérer toutes les photos du pressing
 *     tags: [Pressing Management - Photos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Photos récupérées avec succès
 *       404:
 *         description: Pressing non trouvé
 */
router.get('/photos', getPressingPhotos);

/**
 * @swagger
 * /api/v1/pressing/photos/gallery:
 *   post:
 *     summary: Upload une photo dans la galerie
 *     tags: [Pressing Management - Photos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *               caption:
 *                 type: string
 *               isPrimary:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Photo uploadée avec succès
 *       400:
 *         description: Erreur de validation
 */
router.post('/photos/gallery', uploadGalleryPhoto);

/**
 * @swagger
 * /api/v1/pressing/photos/profile:
 *   post:
 *     summary: Upload une photo de profil
 *     tags: [Pressing Management - Photos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo de profil mise à jour
 */
router.post('/photos/profile', uploadProfilePhoto);

/**
 * @swagger
 * /api/v1/pressing/photos/cover:
 *   post:
 *     summary: Upload une photo de couverture
 *     tags: [Pressing Management - Photos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo de couverture mise à jour
 */
router.post('/photos/cover', uploadCoverPhoto);

/**
 * @swagger
 * /api/v1/pressing/photos/gallery/{photoId}:
 *   delete:
 *     summary: Supprimer une photo de la galerie
 *     tags: [Pressing Management - Photos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Photo supprimée avec succès
 */
router.delete('/photos/gallery/:photoId', deleteGalleryPhoto);

/**
 * @swagger
 * /api/v1/pressing/photos/gallery/{photoId}/primary:
 *   put:
 *     summary: Définir une photo comme principale
 *     tags: [Pressing Management - Photos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Photo définie comme principale
 */
router.put('/photos/gallery/:photoId/primary', setPrimaryPhoto);

// ===== ROUTES SERVICES =====

/**
 * @swagger
 * /api/v1/pressing/services:
 *   get:
 *     summary: Récupérer tous les services du pressing
 *     tags: [Pressing Management - Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Services récupérés avec succès
 */
router.get('/services', getMyServices);

/**
 * @swagger
 * /api/v1/pressing/services:
 *   post:
 *     summary: Créer un nouveau service
 *     tags: [Pressing Management - Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - category
 *               - duration
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *                 enum: [lavage, repassage, nettoyage_sec, retouche, autre]
 *               duration:
 *                 type: integer
 *                 description: Durée en minutes
 *               isAvailable:
 *                 type: boolean
 *               minOrderQuantity:
 *                 type: integer
 *               maxOrderQuantity:
 *                 type: integer
 *               preparationTime:
 *                 type: integer
 *                 description: Temps de préparation en heures
 *     responses:
 *       201:
 *         description: Service créé avec succès
 */
router.post('/services', createService);

/**
 * @swagger
 * /api/v1/pressing/services/{serviceId}:
 *   get:
 *     summary: Récupérer un service spécifique
 *     tags: [Pressing Management - Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service récupéré avec succès
 */
router.get('/services/:serviceId', getService);

/**
 * @swagger
 * /api/v1/pressing/services/{serviceId}:
 *   put:
 *     summary: Mettre à jour un service
 *     tags: [Pressing Management - Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               duration:
 *                 type: integer
 *               isAvailable:
 *                 type: boolean
 *               minOrderQuantity:
 *                 type: integer
 *               maxOrderQuantity:
 *                 type: integer
 *               preparationTime:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Service mis à jour avec succès
 */
router.put('/services/:serviceId', updateService);

/**
 * @swagger
 * /api/v1/pressing/services/{serviceId}:
 *   delete:
 *     summary: Supprimer un service
 *     tags: [Pressing Management - Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service supprimé avec succès
 */
router.delete('/services/:serviceId', deleteService);

/**
 * @swagger
 * /api/v1/pressing/services/{serviceId}/toggle:
 *   patch:
 *     summary: Activer/désactiver un service
 *     tags: [Pressing Management - Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Disponibilité du service modifiée
 */
router.patch('/services/:serviceId/toggle', toggleServiceAvailability);

// ===== ROUTES HORAIRES =====

/**
 * @swagger
 * /api/v1/pressing/hours:
 *   get:
 *     summary: Récupérer les horaires du pressing
 *     tags: [Pressing Management - Hours]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Horaires récupérés avec succès
 */
router.get('/hours', getMyHours);

/**
 * @swagger
 * /api/v1/pressing/hours:
 *   put:
 *     summary: Mettre à jour tous les horaires
 *     tags: [Pressing Management - Hours]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hours:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     day:
 *                       type: string
 *                       enum: [lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche]
 *                     open:
 *                       type: string
 *                       pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                     close:
 *                       type: string
 *                       pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                     isClosed:
 *                       type: boolean
 *                     specialHours:
 *                       type: object
 *     responses:
 *       200:
 *         description: Horaires mis à jour avec succès
 */
router.put('/hours', updateAllHours);

/**
 * @swagger
 * /api/v1/pressing/hours/{day}:
 *   put:
 *     summary: Mettre à jour les horaires d'un jour spécifique
 *     tags: [Pressing Management - Hours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: day
 *         required: true
 *         schema:
 *           type: string
 *           enum: [lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               open:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *               close:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *               isClosed:
 *                 type: boolean
 *               specialHours:
 *                 type: object
 *     responses:
 *       200:
 *         description: Horaires du jour mis à jour
 */
router.put('/hours/:day', updateDayHours);

/**
 * @swagger
 * /api/v1/pressing/hours/copy:
 *   post:
 *     summary: Copier les horaires d'un jour vers d'autres jours
 *     tags: [Pressing Management - Hours]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sourceDay:
 *                 type: string
 *                 enum: [lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche]
 *               targetDays:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche]
 *     responses:
 *       200:
 *         description: Horaires copiés avec succès
 */
router.post('/hours/copy', copyHours);

/**
 * @swagger
 * /api/v1/pressing/hours/status:
 *   get:
 *     summary: Vérifier le statut d'ouverture actuel
 *     tags: [Pressing Management - Hours]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statut récupéré avec succès
 */
router.get('/hours/status', getCurrentStatus);

module.exports = router;
