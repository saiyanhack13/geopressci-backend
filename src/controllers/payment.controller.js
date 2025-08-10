const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Order = require('../models/order.model');
const Payment = require('../models/payment.model'); // Ce modèle sera à créer
// const { initiateMobileMoneyPayment, checkPaymentStatus } = require('../services/payment.service'); // Ce service sera à créer

/**
 * @desc    Initier un paiement pour une commande
 * @route   POST /api/v1/payments/initiate
 * @access  Private (Client)
 */
exports.initiatePayment = asyncHandler(async (req, res, next) => {
  const { commandeId, paymentMethod, phoneNumber } = req.body;
  const clientId = req.user.id;

  const commande = await Order.findById(commandeId);

  // Vérifications
  if (!commande) {
    return next(new ErrorResponse(`Commande non trouvée avec l'id ${commandeId}`, 404));
  }
  if (commande.customer.toString() !== clientId) {
    return next(new ErrorResponse('Non autorisé à payer cette commande', 403));
  }
  if (commande.statutPaiement === 'paye') {
    return next(new ErrorResponse('Cette commande a déjà été payée', 400));
  }

  // Logique d'initiation du paiement (simulation)
  // Dans un cas réel, on appellerait un service de paiement externe (CinetPay, etc.)
  const transactionId = `TXN_${Date.now()}`;
  const paymentData = {
    transactionId,
    amount: commande.prixTotal,
    currency: 'XOF',
    status: 'pending',
    paymentMethod,
    commande: commandeId,
    client: clientId
  };

  // Simuler l'appel à un service externe
  console.log(`Initiating payment for order ${commande.reference} via ${paymentMethod}...`);

  // Créer un enregistrement de paiement dans la DB
  // const payment = await Payment.create(paymentData);

  res.status(200).json({
    success: true,
    message: 'Paiement initié. Veuillez confirmer sur votre téléphone.',
    data: { transactionId, status: 'pending' }
  });
});

/**
 * @desc    Vérifier le statut d'un paiement
 * @route   GET /api/v1/payments/:transactionId/status
 * @access  Private (Client)
 */
exports.getPaymentStatus = asyncHandler(async (req, res, next) => {
  const { transactionId } = req.params;
  const clientId = req.user.id;

  // Dans un cas réel, on vérifierait la transaction dans notre DB
  // const payment = await Payment.findOne({ transactionId, client: clientId });
  // if (!payment) {
  //   return next(new ErrorResponse(`Transaction non trouvée`, 404));
  // }

  // Simuler la vérification du statut
  const possibleStatus = ['succeeded', 'failed', 'pending'];
  const randomStatus = possibleStatus[Math.floor(Math.random() * possibleStatus.length)];

  // Si le paiement a réussi, mettre à jour la commande
  if (randomStatus === 'succeeded') {
    // await Order.findByIdAndUpdate(payment.commande, { statutPaiement: 'paye' });
    // await Payment.findOneAndUpdate({ transactionId }, { status: 'succeeded' });
    console.log(`Payment ${transactionId} succeeded. Order status updated.`);
  }

  res.status(200).json({
    success: true,
    data: { transactionId, status: randomStatus }
  });
});

/**
 * @desc    Récupérer l'historique des paiements
 * @route   GET /api/v1/payments
 * @access  Private (Client, Admin)
 */
exports.getPaymentHistory = asyncHandler(async (req, res, next) => {
  const { status, page = 1, limit = 10 } = req.query;
  const { id: userId, role } = req.user;

  let filter = {};

  if (role === 'client') {
    filter.client = userId;
  }

  if (status) {
    filter.status = status;
  }

  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('commande', 'reference montantTotal')
    .populate('customer', 'nom prenom')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: payments.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: payments,
  });
});

/**
 * @desc    Vérifier un paiement Mobile Money
 * @route   POST /api/v1/payments/verify
 * @access  Private (Client)
 */
exports.verifyPayment = asyncHandler(async (req, res, next) => {
  const { transactionId, provider } = req.body;
  const clientId = req.user.id;

  if (!transactionId || !provider) {
    return next(new ErrorResponse('Transaction ID et fournisseur requis', 400));
  }

  // Rechercher le paiement dans la base de données
  const payment = await Payment.findOne({ 
    transactionId, 
    client: clientId,
    paymentMethod: provider 
  }).populate('commande');

  if (!payment) {
    return next(new ErrorResponse('Transaction non trouvée', 404));
  }

  // Simuler la vérification avec le fournisseur Mobile Money
  // Dans un cas réel, on appellerait l'API du fournisseur
  const verificationResult = {
    success: Math.random() > 0.3, // 70% de chance de succès
    amount: payment.amount,
    currency: payment.currency,
    reference: payment.transactionId
  };

  if (verificationResult.success) {
    // Mettre à jour le statut du paiement
    payment.status = 'succeeded';
    payment.paymentProviderDetails = verificationResult;
    await payment.save();

    // Mettre à jour la commande
    if (payment.commande) {
      await Commande.findByIdAndUpdate(payment.commande._id, {
        statutPaiement: 'paye',
        datePaiement: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Paiement vérifié avec succès',
      data: {
        transactionId: payment.transactionId,
        status: 'succeeded',
        amount: payment.amount,
        currency: payment.currency
      }
    });
  } else {
    payment.status = 'failed';
    await payment.save();

    res.status(400).json({
      success: false,
      message: 'Vérification du paiement échouée',
      data: {
        transactionId: payment.transactionId,
        status: 'failed'
      }
    });
  }
});

/**
 * @desc    Webhook pour les notifications des opérateurs Mobile Money
 * @route   POST /api/v1/payments/webhook
 * @access  Public (Webhook)
 */
exports.handleWebhook = asyncHandler(async (req, res, next) => {
  const { transactionId, status, amount, currency, provider, signature } = req.body;

  // Vérifier la signature du webhook (sécurité)
  // Dans un cas réel, on vérifierait la signature avec la clé secrète du fournisseur
  
  console.log(`Webhook reçu pour transaction ${transactionId}: ${status}`);

  // Trouver le paiement correspondant
  const payment = await Payment.findOne({ transactionId });
  
  if (!payment) {
    console.error(`Transaction non trouvée: ${transactionId}`);
    return res.status(404).json({
      success: false,
      message: 'Transaction non trouvée'
    });
  }

  // Mettre à jour le statut du paiement
  payment.status = status;
  payment.paymentProviderDetails = {
    webhookReceived: true,
    provider,
    amount,
    currency,
    timestamp: new Date()
  };
  await payment.save();

  // Si le paiement est réussi, mettre à jour la commande
  if (status === 'succeeded' && payment.commande) {
    await Commande.findByIdAndUpdate(payment.commande, {
      statutPaiement: 'paye',
      datePaiement: new Date()
    });
    
    console.log(`Commande ${payment.commande} marquée comme payée`);
  }

  // Répondre au webhook
  res.status(200).json({
    success: true,
    message: 'Webhook traité avec succès'
  });
});

/**
 * @desc    Récupérer les méthodes de paiement disponibles
 * @route   GET /api/v1/payments/methods
 * @access  Public
 */
exports.getPaymentMethods = asyncHandler(async (req, res, next) => {
  const paymentMethods = [
    {
      id: 'orangemoney',
      name: 'Orange Money',
      type: 'mobile_money',
      provider: 'Orange CI',
      logo: '/images/payment/orange-money.png',
      prefixes: ['07', '08', '09'],
      minAmount: 100,
      maxAmount: 1000000,
      fees: {
        percentage: 1.5,
        minimum: 25,
        maximum: 5000
      },
      available: true
    },
    {
      id: 'mtnmomo',
      name: 'MTN Mobile Money',
      type: 'mobile_money',
      provider: 'MTN CI',
      logo: '/images/payment/mtn-momo.png',
      prefixes: ['05', '06'],
      minAmount: 100,
      maxAmount: 1000000,
      fees: {
        percentage: 1.5,
        minimum: 25,
        maximum: 5000
      },
      available: true
    },
    {
      id: 'moovmoney',
      name: 'Moov Money',
      type: 'mobile_money',
      provider: 'Moov Africa CI',
      logo: '/images/payment/moov-money.png',
      prefixes: ['01', '02', '03'],
      minAmount: 100,
      maxAmount: 500000,
      fees: {
        percentage: 1.8,
        minimum: 30,
        maximum: 3000
      },
      available: true
    },
    {
      id: 'wave',
      name: 'Wave',
      type: 'mobile_money',
      provider: 'Wave CI',
      logo: '/images/payment/wave.png',
      prefixes: ['01', '02', '03', '05', '06', '07', '08', '09'],
      minAmount: 100,
      maxAmount: 1000000,
      fees: {
        percentage: 1.0,
        minimum: 10,
        maximum: 2500
      },
      available: true
    }
  ];

  res.status(200).json({
    success: true,
    count: paymentMethods.length,
    data: paymentMethods
  });
});

/**
 * @desc    Récupérer l'historique des transactions
 * @route   GET /api/v1/transactions
 * @access  Private (Client, Admin)
 */
exports.getTransactions = asyncHandler(async (req, res, next) => {
  const { status, provider, startDate, endDate, page = 1, limit = 20 } = req.query;
  const { id: userId, role } = req.user;

  let filter = {};

  // Filtrer par utilisateur si c'est un client
  if (role === 'client') {
    filter.client = userId;
  }

  // Filtres optionnels
  if (status) {
    filter.status = status;
  }
  
  if (provider) {
    filter.paymentMethod = provider;
  }

  // Filtre par date
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const total = await Payment.countDocuments(filter);
  const transactions = await Payment.find(filter)
    .populate('commande', 'reference montantTotal')
    .populate('customer', 'nom prenom email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  // Calculer les statistiques
  const stats = await Payment.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        successfulTransactions: {
          $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] }
        },
        failedTransactions: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        pendingTransactions: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    count: transactions.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    stats: stats[0] || {
      totalAmount: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      pendingTransactions: 0
    },
    data: transactions
  });
});

/**
 * @desc    Récupérer le détail d'une transaction
 * @route   GET /api/v1/transactions/:id
 * @access  Private (Client, Admin)
 */
exports.getTransactionById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { id: userId, role } = req.user;

  let filter = { _id: id };
  
  // Si c'est un client, s'assurer qu'il ne peut voir que ses transactions
  if (role === 'client') {
    filter.client = userId;
  }

  const transaction = await Payment.findOne(filter)
    .populate('commande', 'reference montantTotal items')
    .populate('customer', 'nom prenom email telephone');

  if (!transaction) {
    return next(new ErrorResponse('Transaction non trouvée', 404));
  }

  res.status(200).json({
    success: true,
    data: transaction
  });
});
