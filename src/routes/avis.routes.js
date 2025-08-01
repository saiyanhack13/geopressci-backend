const express = require('express');
const router = express.Router();
const avisController = require('../controllers/avis.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Avis
 *   description: Gestion des avis et notes sur les pressings
 */

// Routes publiques
router.get('/pressing/:pressingId', avisController.getAvisByPressing);
router.get('/:id', avisController.getAvisById);

// Routes protégées (authentification requise)
router.use(protect);

// Routes pour les clients
router.post('/', authorize('client'), avisController.creerAvis);
router.put('/:id', authorize('client'), avisController.updateAvis);
router.delete('/:id', authorize('client'), avisController.deleteAvis);

// Routes pour les administrateurs
router.delete('/admin/:id', authorize('admin'), avisController.deleteAvis);

module.exports = router;
