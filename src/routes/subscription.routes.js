const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  submitVerification,
  getSubscriptionStatus,
  updateBillingInfo,
  processPayment,
  cancelSubscription,
  approveVerification,
  rejectVerification,
} = require('../controllers/subscription.controller');

// Routes protégées pour les pressings
router.use(protect);

// Routes pour la gestion des abonnements
router.route('/verify-identity')
  .post(authorize('pressing'), submitVerification);

router.route('/status')
  .get(authorize('pressing'), getSubscriptionStatus);

router.route('/billing')
  .put(authorize('pressing'), updateBillingInfo);

router.route('/pay')
  .post(authorize('pressing'), processPayment);

router.route('/cancel')
  .post(authorize('pressing'), cancelSubscription);

// Routes d'administration (protégées par le rôle admin)
router.route('/admin/pressings/:id/approve-verification')
  .put(protect, authorize('admin'), approveVerification);

router.route('/admin/pressings/:id/reject-verification')
  .put(protect, authorize('admin'), rejectVerification);

module.exports = router;
