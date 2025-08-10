const Pressing = require('../models/pressing.model');
const { ErrorResponse, NotFoundError, BadRequestError } = require('../utils/error.utils');
const notificationController = require('./notification.controller');
const logger = require('../utils/logger');

/**
 * @swagger
 * /subscription/verify-identity:
 *   post:
 *     summary: Soumettre les documents de vérification d'identité
 *     description: Permet à un pressing de soumettre les documents nécessaires pour la vérification d'identité
 *     tags: [Abonnements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documents
 *             properties:
 *               documents:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - type
 *                     - url
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [cni, passport, registre_commerce, autre]
 *                       description: Type de document
 *                       example: 'cni'
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: URL du document stocké
 *                       example: 'https://storage.example.com/documents/cni-12345.jpg'
 *                     description:
 *                       type: string
 *                       description: Description du document (optionnel)
 *                       example: "Carte nationale d'identité recto-verso"
 *     responses:
 *       200:
 *         description: Documents soumis avec succès pour vérification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Documents soumis avec succès. Vérification en cours...'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const submitVerification = async (req, res, next) => {
  try {
    const { documents } = req.body;
    const pressingId = req.user.id;

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      throw new BadRequestError('Veuillez fournir au moins un document de vérification');
    }

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    // Soumettre les documents pour vérification
    await pressing.submitVerificationDocuments(documents);

    // Envoyer une notification à l'administrateur pour la vérification
    // Note: Implémentez cette fonction selon votre système de notification
    await notificationController.notifyAdminForVerification(pressing);

    res.json({
      success: true,
      message: 'Documents soumis avec succès. Vérification en cours...',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /subscription/status:
 *   get:
 *     summary: Obtenir le statut de l'abonnement actuel
 *     description: Récupère les informations détaillées sur l'état actuel de l'abonnement du pressing
 *     tags: [Abonnements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statut de l'abonnement récupéré avec succès
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
 *                     status:
 *                       type: string
 *                       enum: [essai, actif, expiré, suspendu, annulé]
 *                       example: 'essai'
 *                       description: État actuel de l'abonnement
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-01-15T00:00:00.000Z'
 *                       description: Date de début de l'abonnement
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-02-14T23:59:59.999Z'
 *                       description: Date de fin de l'abonnement
 *                     daysRemaining:
 *                       type: number
 *                       example: 15
 *                       description: Jours restants avant l'expiration (pour les essais)
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                       description: Indique si le compte est actif
 *                     verificationStatus:
 *                       type: string
 *                       enum: [non_soumis, en_attente, approuvé, rejeté]
 *                       example: 'en_attente'
 *                       description: État de la vérification d'identité
 *                     verificationDocuments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: 'cni'
 *                           url:
 *                             type: string
 *                             example: 'https://storage.example.com/documents/cni-12345.jpg'
 *                           status:
 *                             type: string
 *                             example: 'en_attente'
 *                     trialDaysRemaining:
 *                       type: number
 *                       example: 15
 *                       description: Jours restants dans la période d'essai (si applicable)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getSubscriptionStatus = async (req, res, next) => {
  try {
    const pressingId = req.user.id;
    const pressing = await Pressing.findById(pressingId);

    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    const status = pressing.getSubscriptionStatus();
    const isActive = pressing.isAccountActive();
    const verificationStatus = pressing.verificationStatus;

    res.json({
      success: true,
      data: {
        ...status,
        isActive,
        verificationStatus,
        verificationDocuments: pressing.verificationDocuments,
        trialDaysRemaining: status.status === 'essai' ? status.daysRemaining : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /subscription/billing:
 *   put:
 *     summary: Mettre à jour les informations de facturation
 *     description: Permet à un pressing de mettre à jour ses informations de facturation pour les paiements d'abonnement
 *     tags: [Abonnements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *                 description: Nom de l'entreprise (si applicable)
 *                 example: 'Mon Pressing SARL'
 *               siret:
 *                 type: string
 *                 description: Numéro SIRET (pour les entreprises françaises)
 *                 example: '12345678901234'
 *               tvaNumber:
 *                 type: string
 *                 description: Numéro de TVA intracommunautaire
 *                 example: 'FR00123456789'
 *               address:
 *                 type: object
 *                 description: Adresse de facturation
 *                 properties:
 *                   line1:
 *                     type: string
 *                     example: '123 Avenue des Champs-Élysées'
 *                   line2:
 *                     type: string
 *                     example: 'Bâtiment B, 2ème étage'
 *                   city:
 *                     type: string
 *                     example: 'Paris'
 *                   postalCode:
 *                     type: string
 *                     example: '75008'
 *                   country:
 *                     type: string
 *                     example: 'France'
 *               paymentMethod:
 *                 type: object
 *                 description: Informations de paiement (carte bancaire)
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [card, sepa, other]
 *                     example: 'card'
 *                   last4:
 *                     type: string
 *                     description: '4 derniers chiffres de la carte bancaire'
 *                     example: '4242'
 *                   expiryMonth:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 12
 *                     example: 12
 *                   expiryYear:
 *                     type: number
 *                     minimum: 2023
 *                     example: 2025
 *                   cardBrand:
 *                     type: string
 *                     example: 'visa'
 *     responses:
 *       200:
 *         description: Informations de facturation mises à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Informations de facturation mises à jour avec succès'
 *                 data:
 *                   $ref: '#/components/schemas/BillingInfo'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateBillingInfo = async (req, res, next) => {
  try {
    const pressingId = req.user.id;
    const billingInfo = req.body;

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    pressing.billingInfo = {
      ...pressing.billingInfo,
      ...billingInfo,
    };

    await pressing.save();

    res.json({
      success: true,
      message: 'Informations de facturation mises à jour avec succès',
      data: pressing.billingInfo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /subscription/pay:
 *   post:
 *     summary: Effectuer un paiement d'abonnement
 *     description: Traite le paiement pour un nouvel abonnement ou un renouvellement (simulation)
 *     tags: [Abonnements]
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
 *               - planId
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 description: "ID du moyen de paiement (ex: ID de carte bancaire)"
 *                 example: 'pm_1JmN4q2eZvKYlo2C0XyX3X2H'
 *               planId:
 *                 type: string
 *                 enum: [monthly, annual]
 *                 description: Type d'abonnement (mensuel ou annuel)
 *                 example: 'monthly'
 *               couponCode:
 *                 type: string
 *                 description: Code promo (optionnel)
 *                 example: 'PREMIEREMOIS'
 *     responses:
 *       200:
 *         description: Paiement traité avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Paiement réussi. Votre abonnement est maintenant actif.'
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscriptionId:
 *                       type: string
 *                       example: 'sub_1JmN4q2eZvKYlo2C0XyX3X2H'
 *                     status:
 *                       type: string
 *                       enum: [active, trialing, past_due, canceled, unpaid]
 *                       example: 'active'
 *                     currentPeriodStart:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-10-01T00:00:00.000Z'
 *                     currentPeriodEnd:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-11-01T00:00:00.000Z'
 *                     latestInvoiceId:
 *                       type: string
 *                       example: 'in_1JmN4q2eZvKYlo2C0XyX3X2H'
 *                     amountPaid:
 *                       type: number
 *                       example: 5000
 *                     currency:
 *                       type: string
 *                       example: 'XOF'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       402:
 *         description: Échec du paiement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'Votre carte a été refusée. Veuillez vérifier vos informations de paiement.'
 *                 declineCode:
 *                   type: string
 *                   example: 'card_declined'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const processPayment = async (req, res, next) => {
  try {
    const pressingId = req.user.id;
    const { paymentMethod, plan } = req.body;

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    // Vérifier que le pressing est vérifié
    if (pressing.verificationStatus !== 'approuve') {
      throw new BadRequestError('Veuvez d\'abord vérifier votre identité pour souscrire à un abonnement');
    }

    // Montant de l'abonnement en centimes (5000 XOF = 500000)
    const amount = 500000; // 5000 XOF en centimes
    
    // Ici, vous intégreriez normalement un service de paiement comme Stripe
    // Pour l'exemple, nous simulons un paiement réussi
    
    // Mettre à jour l'abonnement
    await pressing.updateSubscription({
      plan: 'mensuel',
      status: 'active',
      amount: amount / 100, // Convertir en unité standard (XOF)
      currency: 'XOF',
      paymentMethod: paymentMethod || 'carte',
      invoiceUrl: 'https://example.com/invoice/123', // URL facture
    });

    // Envoyer une confirmation de paiement
    await notificationController.sendCustomNotification(
      pressing,
      {
        subject: 'Paiement de votre abonnement réussi',
        message: `Votre paiement de 5000 XOF pour l'abonnement mensuel a été effectué avec succès. Merci pour votre confiance !`,
        type: 'both',
      }
    );

    res.json({
      success: true,
      message: 'Paiement effectué avec succès. Votre abonnement est maintenant actif.',
      data: {
        plan: 'mensuel',
        amount: 5000,
        currency: 'XOF',
        nextBillingDate: pressing.nextBillingDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /subscription/cancel:
 *   post:
 *     summary: Annuler l'abonnement
 *     description: Annule l'abonnement actif du pressing. L'accès sera maintenu jusqu'à la fin de la période payée.
 *     tags: [Abonnements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               feedback:
 *                 type: string
 *                 description: Raison de l'annulation (optionnel)
 *                 example: 'Trop cher pour les services offerts.'
 *     responses:
 *       200:
 *         description: Abonnement annulé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Votre abonnement a été annulé avec succès. Vous pourrez continuer à utiliser le service jusqu'au 31/12/2023."
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscriptionId:
 *                       type: string
 *                       example: 'sub_1JmN4q2eZvKYlo2C0XyX3X2H'
 *                     status:
 *                       type: string
 *                       example: 'canceled'
 *                     canceledAt:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-10-15T14:30:00.000Z'
 *                     currentPeriodEnd:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-12-31T23:59:59.000Z'
 *                     cancellationReason:
 *                       type: string
 *                       example: 'Trop cher pour les services offerts.'
 *       400:
 *         description: Impossible d'annuler l'abonnement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'Aucun abonnement actif trouvé à annuler.'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const cancelSubscription = async (req, res, next) => {
  try {
    const pressingId = req.user.id;
    const { reason } = req.body;

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    // Ici, vous annuleriez normalement l'abonnement via l'API de paiement
    // Pour l'exemple, nous marquons simplement l'abonnement comme annulé
    pressing.subscriptionStatus = 'canceled';
    await pressing.save();

    // Envoyer une notification de confirmation d'annulation
    await notificationController.sendCustomNotification(
      pressing,
      {
        subject: 'Annulation de votre abonnement',
        message: `Votre abonnement a été annulé. ${reason ? `Raison : ${reason}` : ''}`,
        type: 'email',
      }
    );

    res.json({
      success: true,
      message: 'Votre abonnement a été annulé avec succès',
    });
  } catch (error) {
    next(error);
  }
};

// Fonctions d'administration (à protéger avec un middleware admin)

/**
 * @swagger
 * /admin/pressings/{id}/approve-verification:
 *   put:
 *     summary: Approuver la vérification d'identité d'un pressing (Admin)
 *     description: Permet à un administrateur d'approuver la vérification d'identité d'un pressing, activant ainsi son compte.
 *     tags: [Administration - Vérifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing à vérifier
 *         example: '5d713995b721c3bb38c1f5d0'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Notes internes sur la vérification (optionnel)
 *                 example: "Documents vérifiés et approuvés manuellement par l'équipe."
 *     responses:
 *       200:
 *         description: Vérification approuvée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Vérification approuvée avec succès. Le compte du pressing a été activé.'
 *                 data:
 *                   $ref: '#/components/schemas/Pressing'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Pressing non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Aucun pressing trouvé avec l'ID 5d713995b721c3bb38c1f5d0"
 *       409:
 *         description: Conflit de statut
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'La vérification a déjà été approuvée pour ce compte.'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const approveVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pressing = await Pressing.findById(id);

    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    await pressing.approveVerification();

    // Notifier le pressing de l'approbation
    await notificationController.sendCustomNotification(
      pressing,
      {
        subject: 'Vérification d\'identité approuvée',
        message: 'Vérification d\'identité approuvée avec succès. Vous pouvez maintenant souscrire à un abonnement.',
        type: 'both',
      }
    );

    res.json({
      success: true,
      message: 'Vérification approuvée avec succès',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/pressings/{id}/reject-verification:
 *   put:
 *     summary: Rejeter la vérification d'identité d'un pressing (Admin)
 *     description: Permet à un administrateur de rejeter la vérification d'identité d'un pressing avec une raison détaillée.
 *     tags: [Administration - Vérifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing dont la vérification est rejetée
 *         example: '5d713995b721c3bb38c1f5d0'
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
 *                 description: Raison détaillée du rejet de la vérification
 *                 example: "La pièce d'identité fournie est illisible. Veuillez fournir une copie plus claire."
 *               notes:
 *                 type: string
 *                 description: Notes internes sur le rejet (optionnel)
 *                 example: 'Le document semble avoir été modifié numériquement.'
 *     responses:
 *       200:
 *         description: Vérification rejetée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Vérification rejetée. Le pressing a été notifié et doit soumettre de nouveaux documents.'
 *                 data:
 *                   $ref: '#/components/schemas/Pressing'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Pressing non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Aucun pressing trouvé avec l'ID 5d713995b721c3bb38c1f5d0"
 *       409:
 *         description: Conflit de statut
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'La vérification a déjà été rejetée pour ce compte.'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const rejectVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new BadRequestError('Veuillez fournir une raison pour le rejet');
    }

    const pressing = await Pressing.findById(id);
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    await pressing.rejectVerification(reason);

    // Notifier le pressing du rejet
    await notificationController.sendCustomNotification(
      pressing,
      {
        subject: 'Vérification d\'identité rejetée',
        message: `Votre demande de vérification d'identité a été rejetée. Raison : ${reason}. Veuillez soumettre à nouveau vos documents.`,
        type: 'both',
      }
    );

    res.json({
      success: true,
      message: 'Vérification rejetée avec succès',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitVerification,
  getSubscriptionStatus,
  updateBillingInfo,
  processPayment,
  cancelSubscription,
  // Fonctions admin
  approveVerification,
  rejectVerification,
};
