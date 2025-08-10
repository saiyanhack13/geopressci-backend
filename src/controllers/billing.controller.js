const Pressing = require('../models/pressing.model');
const { ErrorResponse, NotFoundError, BadRequestError } = require('../utils/error.utils');
const notificationController = require('./notification.controller');
const logger = require('../utils/logger');

/**
 * @swagger
 * /billing/history:
 *   get:
 *     summary: Obtenir l'historique des paiements
 *     description: Récupère l'historique complet des paiements et des factures pour le pressing connecté
 *     tags: [Facturation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Nombre maximum de factures à retourner
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Numéro de la page à récupérer (pour la pagination)
 *     responses:
 *       200:
 *         description: Historique des paiements récupéré avec succès
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
 *                     paymentHistory:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Invoice'
 *                     currentPlan:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: 'Premium Mensuel'
 *                         price:
 *                           type: number
 *                           example: 5000
 *                         currency:
 *                           type: string
 *                           example: 'XOF'
 *                         interval:
 *                           type: string
 *                           example: 'month'
 *                     nextBillingDate:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-11-01T00:00:00.000Z'
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalPaid:
 *                           type: number
 *                           example: 15000
 *                         currency:
 *                           type: string
 *                           example: 'XOF'
 *                         invoicesCount:
 *                           type: integer
 *                           example: 3
 *                         lastInvoiceDate:
 *                           type: string
 *                           format: date-time
 *                           example: '2023-10-01T00:00:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getBillingHistory = async (req, res, next) => {
  try {
    const pressing = await Pressing.findById(req.user.id).select('paymentHistory subscriptionPlan nextBillingDate');
    
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    res.json({
      success: true,
      data: {
        paymentHistory: pressing.paymentHistory,
        currentPlan: pressing.subscriptionPlan,
        nextBillingDate: pressing.nextBillingDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /billing/payment-method:
 *   put:
 *     summary: Mettre à jour la méthode de paiement
 *     description: Permet à un pressing de mettre à jour sa méthode de paiement pour les factures récurrentes
 *     tags: [Facturation]
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
 *               - cardDetails
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 description: Identifiant unique du moyen de paiement (fourni par le processeur de paiement)
 *                 example: 'pm_1JmN4q2eZvKYlo2C0XyX3X2H'
 *               cardDetails:
 *                 type: object
 *                 required:
 *                   - last4
 *                   - brand
 *                   - expMonth
 *                   - expYear
 *                 properties:
 *                   last4:
 *                     type: string
 *                     minLength: 4
 *                     maxLength: 4
 *                     description: '4 derniers chiffres de la carte'
 *                     example: '4242'
 *                   brand:
 *                     type: string
 *                     enum: [visa, mastercard, american_express, discover, jcb, diners, unionpay, unknown]
 *                     description: Marque de la carte
 *                     example: 'visa'
 *                   expMonth:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 12
 *                     description: Mois d'expiration (1-12)
 *                     example: 12
 *                   expYear:
 *                     type: integer
 *                     minimum: 2023
 *                     description: Année d'expiration (format 4 chiffres)
 *                     example: 2025
 *                   country:
 *                     type: string
 *                     minLength: 2
 *                     maxLength: 2
 *                     description: Code pays à 2 lettres de la carte (optionnel)
 *                     example: 'CI'
 *     responses:
 *       200:
 *         description: Méthode de paiement mise à jour avec succès
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
 *                   example: 'Méthode de paiement mise à jour avec succès'
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentMethodId:
 *                       type: string
 *                       example: 'pm_1JmN4q2eZvKYlo2C0XyX3X2H'
 *                     last4:
 *                       type: string
 *                       example: '4242'
 *                     brand:
 *                       type: string
 *                       example: 'visa'
 *                     expDate:
 *                       type: string
 *                       example: '12/25'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updatePaymentMethod = async (req, res, next) => {
  try {
    const { paymentMethodId, cardDetails } = req.body;
    
    if (!paymentMethodId) {
      throw new BadRequestError('Veuillez fournir un identifiant de méthode de paiement');
    }

    const pressing = await Pressing.findById(req.user.id);
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    // Mettre à jour les informations de paiement
    pressing.paymentMethod = {
      id: paymentMethodId,
      last4: cardDetails?.last4,
      brand: cardDetails?.brand,
      expMonth: cardDetails?.expMonth,
      expYear: cardDetails?.expYear,
    };

    await pressing.save();

    // Envoyer une notification de confirmation
    await notificationController.sendCustomNotification(
      pressing,
      {
        subject: 'Méthode de paiement mise à jour',
        message: 'Votre méthode de paiement a été mise à jour avec succès.',
        type: 'email',
      }
    );

    res.json({
      success: true,
      message: 'Méthode de paiement mise à jour avec succès',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /billing/cancel-subscription:
 *   post:
 *     summary: Annuler l'abonnement actif
 *     description: Permet à un pressing d'annuler son abonnement actif. L'accès sera maintenu jusqu'à la fin de la période payée.
 *     tags: [Facturation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Raison de l'annulation (optionnel)
 *                 example: "Je ne suis plus intéressé par les services proposés."
 *               feedback:
 *                 type: string
 *                 description: Commentaires supplémentaires (optionnel)
 *                 example: "J'ai trouvé une alternative moins chère."
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
 *                     status:
 *                       type: string
 *                       example: 'canceled'
 *                     canceledAt:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-10-15T14:30:00.000Z'
 *                     accessUntil:
 *                       type: string
 *                       format: date
 *                       example: '2023-12-31'
 *                     canReactivateUntil:
 *                       type: string
 *                       format: date
 *                       description: Date limite pour réactiver l'abonnement sans frais supplémentaires
 *                       example: '2024-01-31'
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
    const { reason } = req.body;
    const pressing = await Pressing.findById(req.user.id);
    
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    // Vérifier si l'utilisateur a un abonnement actif
    if (pressing.subscriptionStatus !== 'active') {
      throw new BadRequestError('Aucun abonnement actif trouvé');
    }

    // Marquer l'abonnement comme annulé
    pressing.subscriptionStatus = 'canceled';
    pressing.subscriptionEndDate = new Date();
    await pressing.save();

    // Envoyer une notification de confirmation d'annulation
    await notificationController.sendCustomNotification(
      pressing,
      {
        subject: 'Abonnement annulé',
        message: `Votre abonnement a été annulé avec succès. ${reason ? `Raison : ${reason}` : ''}`,
        type: 'both',
      }
    );

    res.json({
      success: true,
      message: 'Votre abonnement a été annulé avec succès',
      data: {
        subscriptionStatus: pressing.subscriptionStatus,
        subscriptionEndDate: pressing.subscriptionEndDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /billing/resume-subscription:
 *   post:
 *     summary: Reprendre un abonnement annulé
 *     description: Permet à un pressing de réactiver un abonnement précédemment annulé, sous réserve qu'il soit toujours dans la période de grâce.
 *     tags: [Facturation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 description: Identifiant du moyen de paiement à utiliser (optionnel, utilise le moyen existant si non fourni)
 *                 example: 'pm_1JmN4q2eZvKYlo2C0XyX3X2H'
 *     responses:
 *       200:
 *         description: Abonnement réactivé avec succès
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
 *                   example: 'Votre abonnement a été réactivé avec succès. Votre prochaine date de facturation est le 01/11/2023.'
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: 'active'
 *                     currentPeriodStart:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-10-15T15:45:00.000Z'
 *                     currentPeriodEnd:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-11-15T23:59:59.999Z'
 *                     nextBillingDate:
 *                       type: string
 *                       format: date
 *                       example: '2023-11-15'
 *       400:
 *         description: Impossible de réactiver l'abonnement
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
 *                   oneOf:
 *                     - example: 'Aucun abonnement annulé trouvé à réactiver.'
 *                     - example: "La période de grâce pour réactiver votre abonnement est expirée."
 *                     - example: "Veuvez fournir un moyen de paiement valide pour réactiver votre abonnement."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const resumeSubscription = async (req, res, next) => {
  try {
    const pressing = await Pressing.findById(req.user.id);
    
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    // Vérifier si l'utilisateur a un abonnement annulé
    if (pressing.subscriptionStatus !== 'canceled') {
      throw new BadRequestError('Aucun abonnement annulé trouvé');
    }

    // Ici, vous intégreriez normalement avec l'API de paiement pour reprendre l'abonnement
    // Pour l'exemple, nous marquons simplement l'abonnement comme actif
    pressing.subscriptionStatus = 'active';
    pressing.subscriptionEndDate = null;
    
    // Définir la date de prochaine facturation (1 mois plus tard)
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    pressing.nextBillingDate = nextBilling;
    
    await pressing.save();

    // Envoyer une notification de confirmation de reprise
    await notificationController.sendCustomNotification(
      pressing,
      {
        subject: 'Abonnement repris',
        message: 'Votre abonnement a été réactivé avec succès.',
        type: 'both',
      }
    );

    res.json({
      success: true,
      message: 'Votre abonnement a été réactivé avec succès',
      data: {
        subscriptionStatus: pressing.subscriptionStatus,
        nextBillingDate: pressing.nextBillingDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /billing/change-plan:
 *   post:
 *     summary: Changer de forfait d'abonnement
 *     description: Permet à un pressing de changer son forfait d'abonnement actuel pour un autre forfait disponible
 *     tags: [Facturation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPlan
 *             properties:
 *               newPlan:
 *                 type: string
 *                 enum: [essai, basique, standard, premium, entreprise]
 *                 description: Identifiant du nouveau forfait d'abonnement
 *                 example: 'premium'
 *               paymentMethodId:
 *                 type: string
 *                 description: Identifiant du moyen de paiement à utiliser (requis si changement vers un forfait payant)
 *                 example: 'pm_1JmN4q2eZvKYlo2C0XyX3X2H'
 *               prorationDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date à laquelle appliquer la mise à jour (optionnel, par défaut immédiat)
 *                 example: '2023-11-01T00:00:00.000Z'
 *     responses:
 *       200:
 *         description: Forfait d'abonnement changé avec succès
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
 *                   example: 'Votre forfait a été mis à jour avec succès'
 *                 data:
 *                   type: object
 *                   properties:
 *                     oldPlan:
 *                       type: string
 *                       example: 'standard'
 *                     newPlan:
 *                       type: string
 *                       example: 'premium'
 *                     nextBillingDate:
 *                       type: string
 *                       format: date-time
 *                       example: '2023-11-01T00:00:00.000Z'
 *                     prorationAmount:
 *                       type: number
 *                       description: Montant du crédit ou du débit dû au changement de forfait
 *                       example: -1500
 *                     currency:
 *                       type: string
 *                       example: 'XOF'
 *       400:
 *         description: Impossible de changer de forfait
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
 *                   oneOf:
 *                     - example: "Veuillez spécifier un nouveau forfait"
 *                     - example: "Vous êtes déjà abonné à ce forfait"
 *                     - example: 'Forfait non valide'
 *                     - example: "Un moyen de paiement valide est requis pour ce forfait"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const changeSubscriptionPlan = async (req, res, next) => {
  try {
    const { newPlan } = req.body;
    
    if (!newPlan) {
      throw new BadRequestError('Veuillez spécifier un nouveau forfait');
    }

    const pressing = await Pressing.findById(req.user.id);
    if (!pressing) {
      throw new NotFoundError('Pressing non trouvé');
    }

    // Vérifier si le nouveau forfait est différent de l'actuel
    if (pressing.subscriptionPlan === newPlan) {
      throw new BadRequestError('Vous êtes déjà abonné à ce forfait');
    }

    // Ici, vous intégreriez normalement avec l'API de paiement pour changer de forfait
    // Pour l'exemple, nous mettons simplement à jour le forfait
    const oldPlan = pressing.subscriptionPlan;
    pressing.subscriptionPlan = newPlan;
    
    // Si c'est un changement de forfait payant, mettre à jour la date de prochaine facturation
    if (newPlan !== 'essai') {
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);
      pressing.nextBillingDate = nextBilling;
    }
    
    await pressing.save();

    // Envoyer une notification de confirmation de changement de forfait
    await notificationController.sendCustomNotification(
      pressing,
      {
        subject: 'Changement de forfait',
        message: `Votre forfait a été changé de ${oldPlan} à ${newPlan}.`,
        type: 'both',
      }
    );

    res.json({
      success: true,
      message: 'Votre forfait a été mis à jour avec succès',
      data: {
        oldPlan,
        newPlan: pressing.subscriptionPlan,
        nextBillingDate: pressing.nextBillingDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /billing/invoices/{invoiceId}:
 *   get:
 *     summary: Obtenir les détails d'une facture
 *     description: Récupère les détails d'une facture spécifique pour le pressing connecté
 *     tags: [Facturation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant unique de la facture
 *         example: '5f8d8f9d8f9d8f9d8f9d8f9d'
 *     responses:
 *       200:
 *         description: Détails de la facture récupérés avec succès
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
 *                     invoice:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: '5f8d8f9d8f9d8f9d8f9d8f9d'
 *                         invoiceNumber:
 *                           type: string
 *                           example: 'INV-2023-001'
 *                         amount:
 *                           type: number
 *                           example: 5000
 *                         currency:
 *                           type: string
 *                           example: 'XOF'
 *                         status:
 *                           type: string
 *                           enum: [paid, pending, failed, refunded]
 *                           example: 'paid'
 *                         paymentDate:
 *                           type: string
 *                           format: date-time
 *                           example: '2023-10-01T12:00:00.000Z'
 *                         dueDate:
 *                           type: string
 *                           format: date
 *                           example: '2023-10-31'
 *                         periodStart:
 *                           type: string
 *                           format: date
 *                           example: '2023-10-01'
 *                         periodEnd:
 *                           type: string
 *                           format: date
 *                           example: '2023-10-31'
 *                         paymentMethod:
 *                           type: string
 *                           example: 'Carte de crédit (•••• 4242)'
 *                         items:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               description:
 *                                 type: string
 *                                 example: 'Abonnement Premium - Octobre 2023'
 *                               amount:
 *                                 type: number
 *                                 example: 5000
 *                               quantity:
 *                                 type: number
 *                                 example: 1
 *                     pressing:
 *                       type: object
 *                       properties:
 *                         nomCommerce:
 *                           type: string
 *                           example: 'Mon Pressing Pro'
 *                         adresse:
 *                           type: string
 *                           example: "123 Avenue des Champs, Abidjan, Côte d'Ivoire"
 *                         email:
 *                           type: string
 *                           format: email
 *                           example: 'contact@monpressing.ci'
 *                         phone:
 *                           type: string
 *                           example: '+2250700000000'
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Facture non trouvée
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
 *                   example: "Facture non trouvée"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getInvoice = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const pressing = await Pressing.findOne({
      _id: req.user.id,
      'paymentHistory._id': invoiceId,
    });

    if (!pressing) {
      throw new NotFoundError('Facture non trouvée');
    }

    const invoice = pressing.paymentHistory.id(invoiceId);
    
    // Ici, vous généreriez normalement un PDF de la facture
    // Pour l'exemple, nous renvoyons simplement les données de la facture
    res.json({
      success: true,
      data: {
        invoice: {
          id: invoice._id,
          amount: invoice.amount,
          currency: invoice.currency,
          paymentDate: invoice.paymentDate,
          paymentMethod: invoice.paymentMethod,
          status: invoice.status,
          // Ajoutez d'autres détails de facturation ici
        },
        pressing: {
          nomCommerce: pressing.nomCommerce,
          adresse: pressing.adresse,
          email: pressing.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBillingHistory,
  updatePaymentMethod,
  cancelSubscription,
  resumeSubscription,
  changeSubscriptionPlan,
  getInvoice,
};
