const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminDashboardController = require('../controllers/adminDashboard.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../config/roles');

// Routes d'authentification
router.post('/auth/login', adminController.login);

// Désactiver la protection en mode développement
if (process.env.NODE_ENV !== 'development') {
  // Protéger toutes les routes suivantes en production
  router.use(protect);
  router.use(authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]));
} else {
  // Middleware pour simuler un utilisateur admin en développement
  router.use((req, res, next) => {
    if (!req.user) {
      req.user = {
        _id: 'dev-user-id',
        roles: [ROLES.ADMIN],
        id: 'dev-user-id'
      };
    }
    next();
  });
}

// Routes de gestion des administrateurs
router.route('/')
  .get(
    authorize(ROLES.SUPER_ADMIN),
    adminController.getAdmins
  )
  .post(
    authorize(ROLES.SUPER_ADMIN),
    adminController.createAdmin
  );

router.route('/:id')
  .put(adminController.updateAdmin)
  .delete(
    authorize(ROLES.SUPER_ADMIN),
    adminController.deleteAdmin
  );

// Routes de gestion des statistiques
router.get('/stats', adminController.getSystemStats);

// Routes de gestion des pressings
router.route('/pressings')
  .get(adminController.getPressings);

router.route('/pressings/:id')
  .put(adminController.updatePressing)
  .delete(adminController.deletePressing);

router.patch('/pressings/:id/status', adminController.updatePressingStatus);

// Dashboard Routes

// User Management
router.get('/users', 
  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  adminDashboardController.getUsers
);

router.patch('/users/:id/status', 
  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  adminDashboardController.updateUserStatus
);

// Report Generation
router.post('/reports/generate',
  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  adminDashboardController.generateReport
);

router.get('/reports/:id',
  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  adminDashboardController.getReport
);

// Promotion Management
router.route('/promotions')
  .get(
    authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    adminDashboardController.getPromotions
  )
  .post(
    authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    adminDashboardController.createPromotion
  );

router.route('/promotions/:id')
  .get(
    authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    adminDashboardController.getPromotionById
  )
  .put(
    authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    adminDashboardController.updatePromotion
  )
  .delete(
    authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    adminDashboardController.deletePromotion
  );

router.patch('/promotions/:id/status',
  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  adminDashboardController.updatePromotionStatus
);

module.exports = router;
