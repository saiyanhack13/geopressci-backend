const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration de multer pour les uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../../uploads/photos');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `photo-${uniqueSuffix}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});
const { protect, authorize } = require('../middleware/auth.middleware');
const { requireActiveSubscription, requireIdentityVerification } = require('../middleware/subscription');
const pressingController = require('../controllers/pressing.controller');

/**
 * @swagger
 * tags:
 *   name: Pressings
 *   description: 'Gestion des pressings'
 */

// Routes publiques
router.get('/', pressingController.getPressings);
/**
 * @swagger
 * /api/v1/pressings/nearby:
 *   get:
 *     summary: Trouver les pressings à proximité
 *     tags: [Pressings]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: 'Latitude de la position'
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: 'Longitude de la position'
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10
 *         description: 'Rayon de recherche en kilomètres'
 *     responses:
 *       200:
 *         description: 'Liste des pressings à proximité avec distance'
 *       400:
 *         description: 'Coordonnées manquantes'
 */
router.get('/nearby', pressingController.getPressingsNearby);

/**
 * @swagger
 * /api/v1/pressings/search:
 *   get:
 *     summary: Recherche avancée de pressings
 *     tags: [Pressings]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: 'Terme de recherche (nom, description)'
 *       - in: query
 *         name: services
 *         schema:
 *           type: string
 *         description: 'Services recherchés (séparés par des virgules)'
 *       - in: query
 *         name: neighborhood
 *         schema:
 *           type: string
 *         description: 'Quartier d''Abidjan'
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         description: 'Note minimale'
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: 'Prix maximum'
 *       - in: query
 *         name: isOpen
 *         schema:
 *           type: boolean
 *         description: 'Filtrer les pressings ouverts maintenant'
 *       - in: query
 *         name: hasDelivery
 *         schema:
 *           type: boolean
 *         description: 'Filtrer les pressings avec livraison'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: 'Numéro de page'
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 'Nombre de résultats par page'
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [rating, distance, price, name]
 *         description: 'Critère de tri'
 *     responses:
 *       200:
 *         description: 'Résultats de recherche avec métadonnées'
 */
router.get('/search', pressingController.searchPressings);

// Routes pour la galerie photos - doivent être placées avant les routes avec :id

/**
 * @swagger
 * /api/v1/pressings/photos:
 *   get:
 *     tags: [Pressing Photos]
 *     summary: Récupère toutes les photos d'un pressing
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des photos du pressing
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PressingPhoto'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: 'Pressing non trouvé'
 */
router.get('/photos', protect, authorize('pressing'), pressingController.getPressingPhotos);

/**
 * @swagger
 * /api/v1/pressings/photos:
 *   post:
 *     tags: [Pressing Photos]
 *     summary: Ajoute une nouvelle photo au pressing (via URL)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - title
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL de la photo
 *               title:
 *                 type: string
 *                 description: Titre de la photo
 *               description:
 *                 type: string
 *                 description: Description optionnelle de la photo
 *               isPublic:
 *                 type: boolean
 *                 description: Si la photo est visible publiquement
 *                 default: true
 *     responses:
 *       201:
 *         description: Photo ajoutée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PressingPhoto'
 *       400:
 *         description: 'Données invalides fournies'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 'Non autorisé à ajouter des photos à ce pressing'
 *       404:
 *         description: 'Pressing non trouvé'
 */
router.post(
  '/photos',
  protect,
  authorize('pressing'),
  requireIdentityVerification,
  requireActiveSubscription,
  pressingController.uploadPressingPhoto
);

/**
 * @swagger
 * /api/v1/pressings/photos/{photoId}:
 *   put:
 *     tags: [Pressing Photos]
 *     summary: Met à jour les informations d'une photo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la photo à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Nouveau titre de la photo
 *               description:
 *                 type: string
 *                 description: Nouvelle description de la photo
 *               isPublic:
 *                 type: boolean
 *                 description: Si la photo est visible publiquement
 *     responses:
 *       200:
 *         description: Photo mise à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PressingPhoto'
 *       400:
 *         description: 'Données invalides fournies'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 'Non autorisé à modifier cette photo'
 *       404:
 *         description: 'Photo non trouvée'
 */
router.put(
  '/photos/:photoId',
  protect,
  authorize('pressing'),
  requireIdentityVerification,
  requireActiveSubscription,
  pressingController.updatePressingPhoto
);

/**
 * @swagger
 * /api/v1/pressings/photos/{photoId}:
 *   delete:
 *     tags: [Pressing Photos]
 *     summary: Supprime une photo du pressing
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la photo à supprimer
 *     responses:
 *       200:
 *         description: Photo supprimée avec succès
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 'Non autorisé à supprimer cette photo'
 *       404:
 *         description: 'Photo non trouvée'
 */
router.delete(
  '/photos/:photoId',
  protect,
  authorize('pressing'),
  requireIdentityVerification,
  requireActiveSubscription,
  pressingController.deletePressingPhoto
);

/**
 * @swagger
 * /api/v1/pressings/photos/upload:
 *   post:
 *     tags: [Pressing Photos]
 *     summary: Télécharge une nouvelle photo pour le pressing (fichier)
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
 *                 description: Fichier image à télécharger
 *               title:
 *                 type: string
 *                 description: Titre de la photo
 *               description:
 *                 type: string
 *                 description: Description optionnelle de la photo
 *               isPublic:
 *                 type: boolean
 *                 description: Si la photo est visible publiquement
 *                 default: true
 *     responses:
 *       201:
 *         description: Photo téléchargée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PressingPhoto'
 *       400:
 *         description: 'Fichier invalide ou données manquantes'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 'Non autorisé à ajouter des photos à ce pressing'
 *       404:
 *         description: 'Pressing non trouvé'
 *       413:
 *         description: 'Fichier trop volumineux (max 5MB)'
 *       415:
 *         description: 'Type de fichier non autorisé (uniquement jpg, jpeg, png, webp)'
 */
// TODO: Réactiver la vérification d'identité en production
router.post(
  '/photos/upload',
  protect,
  authorize('pressing'),
  // requireIdentityVerification, // Temporairement désactivé pour le développement
  // requireActiveSubscription, // Temporairement désactivé pour le développement
  upload.single('photo'),
  pressingController.uploadPhotoFile
);

// Route pour les statistiques (pressing uniquement) - DOIT ÊTRE AVANT /:id
/**
 * @swagger
 * /api/v1/pressing/stats:
 *   get:
 *     summary: Récupérer les statistiques d'un pressing
 *     tags: [Pressings]
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     todayOrders:
 *                       type: number
 *                       description: Nombre de commandes aujourd'hui
 *                       example: 5
 *                     monthlyRevenue:
 *                       type: number
 *                       description: Revenus du mois en FCFA
 *                       example: 125000
 *                     activeCustomers:
 *                       type: number
 *                       description: Nombre de clients actifs ce mois
 *                       example: 23
 *                     avgRating:
 *                       type: number
 *                       description: Note moyenne du pressing
 *                       example: 4.2
 *                     pendingOrders:
 *                       type: number
 *                       description: Nombre de commandes en attente
 *                       example: 8
 *                     completedToday:
 *                       type: number
 *                       description: Commandes terminées aujourd'hui
 *                       example: 3
 *                     weeklyGrowth:
 *                       type: number
 *                       description: Croissance hebdomadaire en pourcentage
 *                       example: 15.5
 *                     monthlyGrowth:
 *                       type: number
 *                       description: Croissance mensuelle en pourcentage
 *                       example: 22.3
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé - seuls les pressings peuvent accéder
 *       404:
 *         description: Pressing non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats', 
  protect, 
  authorize('Pressing'),
  // requireIdentityVerification, // Temporairement désactivé pour les tests
  // requireActiveSubscription, // Temporairement désactivé pour les tests
  pressingController.getPressingStats
);

// Routes pour les commandes du pressing connecté - DOIT ÊTRE AVANT /:id
router.get('/orders',
  protect,
  authorize('Pressing'),
  // requireIdentityVerification, // Temporairement désactivé pour les tests
  // requireActiveSubscription, // Temporairement désactivé pour les tests
  (req, res) => {
    // Rediriger vers le contrôleur d'orders avec le pressing ID
    req.query.pressingId = req.user._id;
    require('../controllers/order.controller').getOrders(req, res);
  }
);

// Routes pour les notifications du pressing connecté - DOIT ÊTRE AVANT /:id
router.get('/notifications',
  protect,
  authorize('Pressing'),
  // requireIdentityVerification, // Temporairement désactivé pour les tests
  // requireActiveSubscription, // Temporairement désactivé pour les tests
  (req, res) => {
    // Rediriger vers le contrôleur de notifications avec le pressing ID
    req.query.userId = req.user._id;
    require('../controllers/notification.controller').getNotifications(req, res);
  }
);



// Route pour le profil du pressing connecté - DOIT ÊTRE AVANT /:id
router.get('/profile',
  protect,
  authorize('Pressing'),
  // requireIdentityVerification, // Temporairement désactivé pour les tests
  // requireActiveSubscription, // Temporairement désactivé pour les tests
  pressingController.getPressingProfile
);

// Route pour mettre à jour le profil du pressing connecté - DOIT ÊTRE AVANT /:id
router.put('/profile',
  protect,
  authorize('Pressing'),
  // requireIdentityVerification, // Temporairement désactivé pour les tests
  // requireActiveSubscription, // Temporairement désactivé pour les tests
  pressingController.updatePressingProfile
);

// Route pour le géocodage inverse - DOIT ÊTRE AVANT /:id
router.post('/reverse-geocode',
  protect,
  authorize('Pressing'),
  // requireIdentityVerification, // Temporairement désactivé pour les tests
  // requireActiveSubscription, // Temporairement désactivé pour les tests
  pressingController.reverseGeocode
);

// Route pour les revenus du pressing connecté - DOIT ÊTRE AVANT /:id
router.get('/earnings',
  protect,
  authorize('Pressing'),
  // requireIdentityVerification, // Temporairement désactivé pour les tests
  // requireActiveSubscription, // Temporairement désactivé pour les tests
  pressingController.getPressingEarnings
);

// Routes pour les services du pressing connecté - DOIVENT ÊTRE AVANT /:id
router.route('/services')
  .get(
    protect,
    authorize('Pressing'),
    // requireIdentityVerification, // Temporairement désactivé pour les tests
    // requireActiveSubscription, // Temporairement désactivé pour les tests
    pressingController.getPressingServices
  )
  .post(
    protect,
    authorize('Pressing'),
    // requireIdentityVerification, // Temporairement désactivé pour les tests
    // requireActiveSubscription, // Temporairement désactivé pour les tests
    pressingController.addPressingService
  );

router.route('/services/:serviceId')
  .put(
    protect,
    authorize('Pressing'),
    // requireIdentityVerification, // Temporairement désactivé pour les tests
    // requireActiveSubscription, // Temporairement désactivé pour les tests
    pressingController.updatePressingService
  )
  .delete(
    protect,
    authorize('Pressing'),
    // requireIdentityVerification, // Temporairement désactivé pour les tests
    // requireActiveSubscription, // Temporairement désactivé pour les tests
    pressingController.deletePressingService
  );

// Route pour les avis du pressing connecté - DOIT ÊTRE AVANT /:id
router.get('/reviews',
  protect,
  authorize('Pressing'),
  // requireIdentityVerification, // Temporairement désactivé pour les tests
  // requireActiveSubscription, // Temporairement désactivé pour les tests
  pressingController.getPressingReviews
);

// Routes pour les zones de livraison du pressing connecté - DOIVENT ÊTRE AVANT /:id
router.route('/delivery-zones')
  .get(
    protect,
    authorize('Pressing'),
    // requireIdentityVerification, // Temporairement désactivé pour les tests
    // requireActiveSubscription, // Temporairement désactivé pour les tests
    pressingController.getDeliveryZones
  )
  .post(
    protect,
    authorize('Pressing'),
    // requireIdentityVerification, // Temporairement désactivé pour les tests
    // requireActiveSubscription, // Temporairement désactivé pour les tests
    pressingController.createDeliveryZone
  );

router.route('/delivery-zones/:id')
  .get(
    protect,
    authorize('Pressing'),
    // requireIdentityVerification, // Temporairement désactivé pour les tests
    // requireActiveSubscription, // Temporairement désactivé pour les tests
    pressingController.getDeliveryZone
  )
  .put(
    protect,
    authorize('Pressing'),
    // requireIdentityVerification, // Temporairement désactivé pour les tests
    // requireActiveSubscription, // Temporairement désactivé pour les tests
    pressingController.updateDeliveryZone
  )
  .delete(
    protect,
    authorize('Pressing'),
    // requireIdentityVerification, // Temporairement désactivé pour les tests
    // requireActiveSubscription, // Temporairement désactivé pour les tests
    pressingController.deleteDeliveryZone
  );

/**
 * @swagger
 * /api/v1/pressings/{id}/availability:
 *   get:
 *     summary: Vérifier la disponibilité d'un pressing
 *     tags: [Pressings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 'ID du pressing'
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 'Date pour vérifier la disponibilité (défaut: aujourd''hui)'
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *         description: 'Type de service pour vérifier les créneaux'
 *     responses:
 *       200:
 *         description: 'Créneaux disponibles et informations d''ouverture'
 *       404:
 *         description: 'Pressing non trouvé'
 */
router.get('/:id/availability', pressingController.getPressingAvailability);
router.get('/:id', pressingController.getPressing);
router.get('/:id/services', pressingController.getPressingServicesByPublicId);
router.get('/:id/reviews', pressingController.getPressingReviews);

// Routes protégées
router.use(protect);

// Routes pour les propriétaires de pressing et les admins
router.post(
  '/:id/services', 
  authorize('pressing', 'admin'),
 // requireIdentityVerification,
 // requireActiveSubscription,
  pressingController.addPressingService
);

/**
 * @swagger
 * /api/v1/pressings/{id}/reviews:
 *   get:
 *     summary: Récupérer les avis d'un pressing
 *     tags: [Pressings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 'ID du pressing'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: 'Numéro de page'
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 'Nombre d''avis par page'
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: 'Filtrer par note'
 *     responses:
 *       200:
 *         description: 'Liste des avis du pressing'
 *       404:
 *         description: 'Pressing non trouvé'
 *   post:
 *     summary: Ajouter un avis sur un pressing
 *     tags: [Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 'ID du pressing'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *               - comment
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: 'Note de 1 à 5'
 *               comment:
 *                 type: string
 *                 description: 'Commentaire sur le service'
 *     responses:
 *       201:
 *         description: 'Avis ajouté avec succès'
 *       400:
 *         description: 'Données invalides'
 *       401:
 *         description: 'Non autorisé'
 *       404:
 *         description: 'Pressing non trouvé'
 */
router.get('/:id/reviews', pressingController.getPressingReviews);

// Route pour ajouter un avis (clients uniquement)
router.post(
  '/:id/reviews',
  authorize('client'),
  pressingController.addPressingReview
);

router.put(
  '/:id/services/:serviceId', 
  authorize('pressing', 'admin'),
  requireIdentityVerification,
  requireActiveSubscription,
  pressingController.updatePressingService
);

router.delete(
  '/:id/services/:serviceId', 
  authorize('pressing', 'admin'),
  requireIdentityVerification,
  requireActiveSubscription,
  pressingController.deletePressingService
);

// Routes pour la gestion des photos (pressing connecté)
router.route('/photos')
  .get(
    protect,
    authorize('pressing'),
    pressingController.getPressingPhotos
  )
  .post(
    protect,
    authorize('pressing'),
    multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(__dirname, '../../uploads/photos');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname);
          cb(null, `photo-${uniqueSuffix}${ext}`);
        }
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Seuls les fichiers image sont autorisés'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
      }
    }).single('photo'),
    pressingController.uploadPhotoFile
  );

router.route('/photos/upload')
  .post(
    protect,
    authorize('pressing'),
    multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(__dirname, '../../uploads/photos');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname);
          cb(null, `photo-${uniqueSuffix}${ext}`);
        }
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Seuls les fichiers image sont autorisés'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
      }
    }).single('photo'),
    pressingController.uploadPhotoFile
  );

router.route('/photos/:photoId')
  .put(protect, authorize('pressing'), pressingController.updatePressingPhoto)
  .delete(protect, authorize('pressing'), pressingController.deletePressingPhoto);

router.route('/photos/:photoId/role')
  .put(protect, authorize('pressing'), pressingController.setPressingPhotoRole);

// Routes pour les admins uniquement
router.use(authorize('admin'));

router.post('/', pressingController.createPressing);
router.put('/:id', pressingController.updatePressing);
router.delete('/:id', pressingController.deletePressing);

module.exports = router;
