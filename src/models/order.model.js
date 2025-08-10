const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schéma pour les articles de la commande
const orderItemSchema = new Schema({
  // Référence au service commandé
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Le service est requis']
  },
  
  // Référence au pressing qui fournit le service
  pressing: {
    type: Schema.Types.ObjectId,
    ref: 'Pressing',
    required: [true, 'Le pressing est requis']
  },
  
  // Détails du service au moment de la commande (pour l'historique)
  serviceDetails: {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    duration: { type: Number, min: 0 }, // en minutes
    imageUrl: String
  },
  
  // Quantité commandée
  quantity: {
    type: Number,
    required: [true, 'La quantité est requise'],
    min: [1, 'La quantité doit être d\'au moins 1'],
    default: 1
  },
  
  // Prix unitaire (peut différer du prix actuel du service)
  unitPrice: {
    type: Number,
    required: [true, 'Le prix unitaire est requis'],
    min: [0, 'Le prix ne peut pas être négatif']
  },
  
  // Remise appliquée (en pourcentage ou montant fixe)
  discount: {
    type: {
      type: String,
      enum: ['percentage', 'fixed', null],
      default: null
    },
    value: { type: Number, default: 0 },
    code: String, // Code promo utilisé
    description: String // Description de la remise
  },
  
  // Options supplémentaires (personnalisation)
  options: [{
    name: { type: String, required: true },
    value: Schema.Types.Mixed,
    additionalCost: { type: Number, default: 0 }
  }],
  
  // Instructions spéciales
  specialInstructions: {
    type: String,
    maxlength: [500, 'Les instructions ne peuvent pas dépasser 500 caractères']
  },
  
  // Statut de l'article
  status: {
    type: String,
    enum: [
      'pending',      // En attente de confirmation
      'confirmed',    // Confirmé par le pressing
      'in_progress',  // En cours de traitement
      'ready',        // Prêt à être récupéré/livré
      'picked_up',    // Récupéré par le client
      'delivered',    // Livré au client
      'cancelled',    // Annulé
      'refunded'      // Remboursé
    ],
    default: 'pending',
    index: true
  },
  
  // Dates importantes
  statusHistory: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { 
      type: String, 
      enum: ['system', 'customer', 'pressing', 'admin'],
      required: true 
    },
    notes: String
  }],
  
  // Suivi de la préparation
  preparation: {
    startTime: Date,
    endTime: Date,
    preparedBy: { type: Schema.Types.ObjectId, ref: 'Pressing' },
    notes: String
  },
  
  // Évaluation du service (remplie après livraison)
  review: {
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    photos: [String],
    reviewedAt: Date,
    ownerReply: {
      text: String,
      repliedAt: Date
    }
  },
  
  // Métadonnées
  metadata: Schema.Types.Mixed
}, { _id: true });

// Schéma pour les frais supplémentaires
const feeSchema = new Schema({
  type: {
    type: String,
    required: [true, 'Le type de frais est requis'],
    enum: ['delivery', 'service', 'tax', 'tip', 'other']
  },
  name: {
    type: String,
    required: [true, 'Le nom du frais est requis']
  },
  amount: {
    type: Number,
    required: [true, 'Le montant du frais est requis'],
    min: [0, 'Le montant ne peut pas être négatif']
  },
  taxIncluded: {
    type: Boolean,
    default: false
  },
  description: String
}, { _id: false });

// Schéma principal de la commande
const orderSchema = new Schema({
  // Numéro de commande unique (format: COMM-YYYYMMDD-XXXXX)
  orderNumber: {
    type: String,
    unique: true,
    index: true
  },
  
  // Référence au client
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Le client est requis'],
    index: true
  },
  
  // Référence au pressing principal (pour les commandes multi-pressings)
  pressing: {
    type: Schema.Types.ObjectId,
    ref: 'Pressing',
    required: [true, 'Le pressing est requis']
  },
  
  // Articles de la commande
  items: [orderItemSchema],
  
  // Informations de livraison
  delivery: {
    // Type de livraison
    type: {
      type: String,
      enum: ['pickup', 'delivery', 'express'],
      default: 'pickup'
    },
    
    // Adresse de collecte
    pickupAddress: {
      street: String,
      city: String,
      postalCode: String,
      country: { type: String, default: 'Côte d\'Ivoire' },
      coordinates: {
        latitude: Number,
        longitude: Number
      },
      instructions: String // Instructions spéciales pour la collecte
    },
    
    // Adresse de livraison (si différente de la collecte)
    deliveryAddress: {
      street: String,
      city: String,
      postalCode: String,
      country: { type: String, default: 'Côte d\'Ivoire' },
      coordinates: {
        latitude: Number,
        longitude: Number
      },
      instructions: String // Instructions spéciales pour la livraison
    },
    
    // Créneaux de collecte et livraison
    pickupSlot: {
      date: Date,
      timeSlot: String, // ex: "09:00-10:00"
      confirmed: { type: Boolean, default: false }
    },
    
    deliverySlot: {
      date: Date,
      timeSlot: String, // ex: "16:00-17:00"
      confirmed: { type: Boolean, default: false }
    },
    
    // Frais de livraison
    fee: {
      type: Number,
      min: 0,
      default: 0
    },
    
    // Distance estimée (en km)
    estimatedDistance: {
      type: Number,
      min: 0
    },
    
    // Temps estimé de livraison (en minutes)
    estimatedTime: {
      type: Number,
      min: 0
    }
  },
  
  // Informations de rendez-vous (intégration système de réservation)
  appointment: {
    // Référence au rendez-vous associé
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      index: true
    },
    
    // Date et heure du rendez-vous
    appointmentDate: {
      type: Date,
      index: true
    },
    
    // Créneau horaire réservé
    timeSlot: {
      type: Schema.Types.ObjectId,
      ref: 'TimeSlot'
    },
    
    // Statut du rendez-vous
    appointmentStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
      default: 'pending'
    },
    
    // Type de rendez-vous
    appointmentType: {
      type: String,
      enum: ['regular', 'express', 'premium', 'bulk'],
      default: 'regular'
    },
    
    // Durée estimée du rendez-vous (en minutes)
    estimatedDuration: {
      type: Number,
      min: 15,
      default: 60
    },
    
    // Durée réelle du rendez-vous (rempli après completion)
    actualDuration: {
      type: Number,
      min: 0
    },
    
    // Notes spéciales pour le rendez-vous
    appointmentNotes: {
      type: String,
      maxLength: 500
    },
    
    // Rappels envoyés
    reminders: {
      sent24h: { type: Boolean, default: false },
      sent2h: { type: Boolean, default: false },
      sent30min: { type: Boolean, default: false }
    },
    
    // Historique des modifications de rendez-vous
    history: [{
      action: {
        type: String,
        enum: ['created', 'confirmed', 'rescheduled', 'cancelled', 'completed']
      },
      date: { type: Date, default: Date.now },
      by: {
        type: Schema.Types.ObjectId,
        refPath: 'appointment.history.byModel'
      },
      byModel: {
        type: String,
        enum: ['Client', 'Pressing', 'Admin']
      },
      reason: String,
      oldValues: Schema.Types.Mixed,
      newValues: Schema.Types.Mixed
    }]
  },
  
  // Type de service (livraison ou retrait en magasin)
  serviceType: {
    type: String,
    enum: ['delivery', 'pickup', 'on_site'],
    required: [true, 'Le type de service est requis']
  },
  
  // Créneau horaire de livraison/retrait
  timeSlot: {
    type: {
      type: String,
      enum: ['asap', 'specific', 'schedule'],
      default: 'asap'
    },
    preferredDate: Date,
    startTime: Date,
    endTime: Date,
    timezone: { type: String, default: 'Africa/Abidjan' }
  },
  
  // Statut global de la commande
  status: {
    type: String,
    enum: [
      'draft',          // Brouillon (panier)
      'pending',        // En attente de paiement
      'confirmed',      // Paiement confirmé, en attente de traitement
      'processing',     // En cours de traitement
      'ready_for_pickup', // Prêt à être récupéré
      'out_for_delivery', // En cours de livraison
      'completed',      // Terminé avec succès
      'cancelled',      // Annulé
      'refunded',       // Remboursé
      'on_hold'         // En attente (problème à résoudre)
    ],
    default: 'draft'
  },
  
  // Historique des statuts
  statusHistory: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { 
      type: String, 
      enum: ['system', 'customer', 'pressing', 'admin'],
      required: true 
    },
    notes: String,
    metadata: Schema.Types.Mixed
  }],
  
  // Paiement
  payment: {
    method: {
      type: String,
      enum: ['cash', 'credit_card', 'mobile_money', 'bank_transfer', 'wallet'],
      required: [true, 'La méthode de paiement est requise']
    },
    status: {
      type: String,
      enum: ['pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending'
    },
    amount: {
      subtotal: { type: Number, required: true, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      delivery: { type: Number, default: 0, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      tip: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'XOF' }
    },
    paymentIntentId: String,
    paymentMethodId: String,
    paymentReceiptUrl: String,
    paymentDetails: Schema.Types.Mixed,
    refunds: [{
      amount: { type: Number, required: true, min: 0.01 },
      reason: String,
      processedAt: { type: Date, default: Date.now },
      processedBy: { type: String, enum: ['system', 'admin', 'pressing'] },
      reference: String,
      metadata: Schema.Types.Mixed
    }]
  },
  
  // Frais supplémentaires
  fees: [feeSchema],
  
  // Code promo appliqué
  promoCode: {
    code: String,
    type: { type: String, enum: ['percentage', 'fixed_amount', 'free_delivery'] },
    value: Number,
    description: String
  },
  
  // Suivi de livraison (si applicable)
  delivery: {
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Pressing' },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed'],
      default: 'pending'
    },
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,
    deliveryProof: {
      type: String,
      description: 'URL de la preuve de livraison (photo, signature, etc.)'
    },
    trackingUrl: String,
    notes: String
  },
  
  // Évaluation globale de la commande
  rating: {
    overall: { type: Number, min: 1, max: 5 },
    punctuality: { type: Number, min: 1, max: 5 },
    quality: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    comment: String,
    photos: [String],
    reviewedAt: Date,
    ownerReply: {
      text: String,
      repliedAt: Date
    }
  },
  
  // Notifications
  notifications: {
    orderConfirmation: { sent: Boolean, sentAt: Date },
    paymentConfirmation: { sent: Boolean, sentAt: Date },
    orderStatusUpdate: { sent: Boolean, sentAt: Date },
    deliveryUpdate: { sent: Boolean, sentAt: Date },
    reviewReminder: { sent: Boolean, sentAt: Date, scheduledFor: Date }
  },
  
  // Métadonnées
  metadata: Schema.Types.Mixed,
  
  // Dates importantes
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
  scheduledFor: Date,
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour les requêtes courantes
orderSchema.index({ 'customer': 1, 'status': 1, 'createdAt': -1 });
orderSchema.index({ 'pressing': 1, 'status': 1, 'createdAt': -1 });
orderSchema.index({ 'delivery.assignedTo': 1, 'delivery.status': 1 });

orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ 'timeSlot.preferredDate': 1, 'timeSlot.startTime': 1 });


// Middleware pour générer le numéro de commande avant la sauvegarde
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    // Générer un numéro de commande unique (ex: COMM-20231115-12345)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    this.orderNumber = `COMM-${dateStr}-${randomNum}`;
  }
  
  // Si le statut a changé, l'ajouter à l'historique
  if (this.isModified('status')) {
    this.statusHistory = this.statusHistory || [];
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      changedBy: this.statusHistory.length === 0 ? 'system' : 'customer',
      notes: 'Statut mis à jour'
    });
  }
  
  // Définir une date d'expiration pour les commandes en attente (24h)
  if (this.status === 'pending' && !this.expiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 1); // 24 heures d'expiration
    this.expiresAt = expiryDate;
  }
  
  next();
});

// Méthodes d'instance

/**
 * Vérifie si la commande peut être annulée
 * @returns {boolean} - True si la commande peut être annulée
 */
orderSchema.methods.canBeCancelled = function() {
  const nonCancellableStatuses = ['completed', 'cancelled', 'refunded', 'out_for_delivery'];
  return !nonCancellableStatuses.includes(this.status);
};

/**
 * Vérifie si la commande peut être modifiée
 * @returns {boolean} - True si la commande peut être modifiée
 */
orderSchema.methods.canBeModified = function() {
  const nonModifiableStatuses = ['completed', 'cancelled', 'refunded', 'out_for_delivery', 'ready_for_pickup'];
  return !nonModifiableStatuses.includes(this.status);
};

/**
 * Calcule le temps estimé de préparation total
 * @returns {number} - Temps de préparation total en minutes
 */
orderSchema.methods.calculatePreparationTime = function() {
  return this.items.reduce((total, item) => {
    return total + ((item.serviceDetails && item.serviceDetails.duration) || 60) * item.quantity;
  }, 0);
};

/**
 * Génère un récapitulif de la commande pour les notifications
 * @returns {Object} - Récapitulif de la commande
 */
orderSchema.methods.getOrderSummary = function() {
  return {
    orderNumber: this.orderNumber,
    status: this.status,
    total: this.payment.amount.total,
    currency: this.payment.amount.currency,
    itemCount: this.items.reduce((sum, item) => sum + item.quantity, 0),
    preparationTime: this.calculatePreparationTime(),
    deliveryAddress: this.deliveryAddress,
    serviceType: this.serviceType,
    timeSlot: this.timeSlot
  };
};

/**
 * Vérifie si la commande est éligible à une évaluation
 * @returns {boolean} - True si la commande peut être évaluée
 */
orderSchema.methods.canBeRated = function() {
  return this.status === 'completed' && 
         !this.rating?.reviewedAt && 
         (!this.items || this.items.every(item => 
           item.status === 'delivered' || item.status === 'picked_up' || 
           item.status === 'cancelled' || item.status === 'refunded'
         ));
};
orderSchema.methods.calculateTotals = function() {
  // Calculer le sous-total
  const subtotal = this.items.reduce((sum, item) => {
    const itemTotal = item.unitPrice * item.quantity;
    const optionsTotal = (item.options || []).reduce((optSum, opt) => {
      return optSum + (opt.additionalCost || 0);
    }, 0);
    return sum + itemTotal + optionsTotal;
  }, 0);
  
  // Calculer les remises
  let discount = 0;
  if (this.promoCode) {
    if (this.promoCode.type === 'percentage') {
      discount = subtotal * (this.promoCode.value / 100);
    } else if (this.promoCode.type === 'fixed_amount') {
      discount = Math.min(subtotal, this.promoCode.value);
    } else if (this.promoCode.type === 'free_delivery') {
      // La livraison gratuite est gérée dans les frais
    }
  }
  
  // Calculer les frais supplémentaires
  const feesTotal = (this.fees || []).reduce((sum, fee) => sum + fee.amount, 0);
  
  // Calculer le total
  const total = Math.max(0, subtotal - discount + feesTotal);
  
  // Mettre à jour les montants
  this.payment = this.payment || {};
  this.payment.amount = {
    subtotal,
    discount,
    fees: feesTotal,
    tax: 0, // À calculer en fonction des taxes applicables
    tip: this.payment?.amount?.tip || 0,
    total,
    currency: this.payment?.amount?.currency || 'XOF'
  };
  
  return this.payment.amount;
};

// Méthode pour annuler une commande
orderSchema.methods.cancel = function(reason, cancelledBy) {
  if (['completed', 'cancelled', 'refunded'].includes(this.status)) {
    throw new Error(`Impossible d'annuler une commande avec le statut: ${this.status}`);
  }
  
  this.status = 'cancelled';
  this.statusHistory.push({
    status: 'cancelled',
    changedAt: new Date(),
    changedBy: cancelledBy || 'system',
    notes: reason || 'Commande annulée',
    metadata: { reason }
  });
  
  // Annuler également tous les articles de la commande
  this.items.forEach(item => {
    if (!['cancelled', 'refunded'].includes(item.status)) {
      item.status = 'cancelled';
      item.statusHistory.push({
        status: 'cancelled',
        changedAt: new Date(),
        changedBy: cancelledBy || 'system',
        notes: 'Annulé avec la commande'
      });
    }
  });
  
  return this.save();
};

// Méthode pour demander un remboursement
orderSchema.methods.requestRefund = function(reason, requestedBy) {
  if (['cancelled', 'refunded'].includes(this.status)) {
    throw new Error(`Impossible de demander un remboursement pour une commande avec le statut: ${this.status}`);
  }
  
  this.status = 'refunded';
  this.statusHistory.push({
    status: 'refunded',
    changedAt: new Date(),
    changedBy: requestedBy || 'customer',
    notes: reason || 'Demande de remboursement',
    metadata: { reason }
  });
  
  // Marquer les articles comme remboursés
  this.items.forEach(item => {
    if (!['cancelled', 'refunded'].includes(item.status)) {
      item.status = 'refunded';
      item.statusHistory.push({
        status: 'refunded',
        changedAt: new Date(),
        changedBy: requestedBy || 'customer',
        notes: 'Remboursé avec la commande'
      });
    }
  });
  
  // Mettre à jour le statut de paiement
  this.payment.status = 'refunded';
  
  return this.save();
};

// Méthode pour mettre à jour le statut d'un article
orderSchema.methods.updateItemStatus = function(itemId, newStatus, changedBy, notes) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Article non trouvé dans la commande');
  }
  
  item.status = newStatus;
  item.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    changedBy: changedBy || 'system',
    notes: notes || 'Mise à jour du statut'
  });
  
  // Mettre à jour le statut global de la commande si nécessaire
  this.updateOrderStatus();
  
  return this.save();
};

// Méthode pour mettre à jour le statut global de la commande en fonction des articles
orderSchema.methods.updateOrderStatus = function() {
  const itemStatuses = this.items.map(item => item.status);
  
  // Si tous les articles sont annulés, annuler la commande
  if (itemStatuses.every(status => status === 'cancelled')) {
    this.status = 'cancelled';
  }
  // Si tous les articles sont remboursés, marquer comme remboursé
  else if (itemStatuses.every(status => status === 'refunded')) {
    this.status = 'refunded';
  }
  // Si tous les articles sont terminés, marquer comme complété
  else if (itemStatuses.every(status => ['delivered', 'picked_up', 'cancelled', 'refunded'].includes(status))) {
    this.status = 'completed';
  }
  // Si au moins un article est en cours de traitement, mettre à jour en conséquence
  else if (itemStatuses.some(status => ['in_progress', 'ready'].includes(status))) {
    this.status = 'processing';
  }
  
  return this;
};

// Méthodes statiques

/**
 * Trouve les commandes par statut avec des options de filtrage avancées
 * @param {string} status - Statut des commandes à rechercher
 * @param {Object} options - Options de recherche
 * @param {string} options.pressingId - ID du pressing pour filtrer
 * @param {string} options.customerId - ID du client pour filtrer
 * @param {string} options.startDate - Date de début pour le filtre
 * @param {string} options.endDate - Date de fin pour le filtre
 * @param {Object} options.sort - Critères de tri
 * @param {number} options.limit - Nombre maximum de résultats
 * @param {number} options.skip - Nombre de résultats à sauter
 * @param {boolean} options.populate - Si vrai, peuple les références
 * @returns {Promise<Array>} - Liste des commandes correspondantes
 */
orderSchema.statics.findByStatus = function(status, options = {}) {
  const query = { status };
  
  // Filtrer par pressing si spécifié
  if (options.pressingId) {
    query.pressing = options.pressingId;
  }
  
  // Filtrer par client si spécifié
  if (options.customerId) {
    query.customer = options.customerId;
  }
  
  // Filtrer par date
  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) query.createdAt.$lte = new Date(options.endDate);
  }
  
  // Trier et paginer
  const sort = options.sort || { createdAt: -1 };
  const limit = options.limit ? parseInt(options.limit, 10) : 10;
  const skip = options.skip ? parseInt(options.skip, 10) : 0;
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('customer', 'name email phone')
    .populate('pressing', 'businessName logo')
    .populate('items.service', 'name description price')
    .lean(options.lean || false);
};

/**
 * Recherche avancée de commandes avec plusieurs critères
 * @param {Object} filters - Filtres de recherche
 * @param {Object} options - Options de pagination et tri
 * @returns {Promise<Object>} - Résultats de la recherche avec pagination
 */
orderSchema.statics.search = async function(filters = {}, options = {}) {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
  const skip = (page - 1) * limit;
  
  // Construction de la requête
  const query = {};
  
  // Filtres de base
  if (filters.status) query.status = filters.status;
  if (filters.customerId) query.customer = filters.customerId;
  if (filters.pressingId) query.pressing = filters.pressingId;
  
  // Filtres de date
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  // Filtres de montant
  if (filters.minAmount || filters.maxAmount) {
    query['payment.amount.total'] = {};
    if (filters.minAmount) query['payment.amount.total'].$gte = parseFloat(filters.minAmount);
    if (filters.maxAmount) query['payment.amount.total'].$lte = parseFloat(filters.maxAmount);
  }
  
  // Exécution de la requête avec pagination
  const [orders, total] = await Promise.all([
    this.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customer', 'name email phone')
      .populate('pressing', 'businessName logo')
      .lean(),
    this.countDocuments(query)
  ]);
  
  return {
    data: orders,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Génère des statistiques sur les commandes
 * @param {Object} filters - Filtres pour les statistiques
 * @returns {Promise<Object>} - Statistiques agrégées
 */
orderSchema.statics.getStats = async function(filters = {}) {
  const match = {};
  
  // Filtres de base
  if (filters.pressingId) match.pressing = mongoose.Types.ObjectId(filters.pressingId);
  if (filters.startDate || filters.endDate) {
    match.createdAt = {};
    if (filters.startDate) match.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) match.createdAt.$lte = new Date(filters.endDate);
  }
  
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$payment.amount.total' },
        avgOrderValue: { $avg: '$payment.amount.total' },
        byStatus: { $push: '$status' }
      }
    },
    {
      $project: {
        _id: 0,
        totalOrders: 1,
        totalRevenue: 1,
        avgOrderValue: 1,
        statusCounts: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: ['$byStatus', []] },
              as: 's',
              in: { k: '$$s', v: { $size: { $filter: { input: '$byStatus', as: 'x', cond: { $eq: ['$$x', '$$s'] } } } } }
            }
          }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    statusCounts: {}
  };
};

/**
 * Crée une commande récurrente basée sur une commande existante
 * @param {string} orderId - ID de la commande à dupliquer
 * @param {Object} options - Options de récurrence
 * @returns {Promise<Object>} - Nouvelle commande créée
 */
orderSchema.statics.createRecurringOrder = async function(orderId, options = {}) {
  const originalOrder = await this.findById(orderId)
    .populate('customer')
    .populate('pressing')
    .populate('items.service');
  
  if (!originalOrder) {
    throw new Error('Commande originale non trouvée');
  }
  
  // Créer une nouvelle commande basée sur l'originale
  const newOrderData = originalOrder.toObject();
  delete newOrderData._id;
  delete newOrderData.orderNumber;
  delete newOrderData.status;
  delete newOrderData.statusHistory;
  delete newOrderData.payment.paymentIntentId;
  delete newOrderData.payment.paymentMethodId;
  delete newOrderData.payment.paymentReceiptUrl;
  
  // Mettre à jour les dates
  const now = new Date();
  newOrderData.createdAt = now;
  newOrderData.updatedAt = now;
  
  // Réinitialiser les statuts des articles
  newOrderData.items = newOrderData.items.map(item => ({
    ...item,
    status: 'pending',
    statusHistory: [{
      status: 'pending',
      changedAt: now,
      changedBy: 'system',
      notes: 'Commande récurrente créée'
    }]
  }));
  
  // Ajouter une référence à la commande originale
  newOrderData.metadata = newOrderData.metadata || {};
  newOrderData.metadata.recurring = {
    isRecurring: true,
    originalOrder: orderId,
    frequency: options.frequency || 'monthly',
    nextOccurrence: this.calculateNextOccurrence(now, options.frequency)
  };
  
  const newOrder = new this(newOrderData);
  await newOrder.save();
  
  return newOrder;
};

/**
 * Calcule la prochaine occurrence d'une commande récurrente
 * @private
 */
orderSchema.statics.calculateNextOccurrence = function(date, frequency) {
  const nextDate = new Date(date);
  
  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }
  
  return nextDate;
};

// Export du modèle
// Suppression des index redondants - ils sont déjà définis dans le schéma
// Ajout d'index pour les recherches textuelles
orderSchema.index({
  'orderNumber': 'text',
  'customer.name': 'text',
  'deliveryAddress.formattedAddress': 'text',
  'items.serviceDetails.name': 'text'
}, {
  weights: {
    'orderNumber': 10,
    'customer.name': 5,
    'deliveryAddress.formattedAddress': 3,
    'items.serviceDetails.name': 2
  },
  name: 'order_search_index'
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
