const mongoose = require('mongoose');

// Types d'abonnement disponibles
const SUBSCRIPTION_TYPES = {
  TRIAL: 'essai',        // Essai gratuit
  MONTHLY: 'mensuel',    // Mensuel
  QUARTERLY: 'trimestriel', // Trimestriel
  YEARLY: 'annuel',      // Annuel
  CUSTOM: 'personnalise' // For custom plans
};

// Statuts d'abonnement
const SUBSCRIPTION_STATUS = {
  ACTIVE: 'actif',
  PENDING: 'en_attente',
  EXPIRED: 'expire',
  CANCELED: 'annule',
  SUSPENDED: 'suspendu',
  TRIAL: 'essai',
  PAST_DUE: 'en_retard',
  UNPAID: 'impaye'
};

// Paiement methods
const PAYMENT_METHODS = {
  ORANGE_MONEY: 'orange_money',
  MTN_MONEY: 'mtn_money',
  MOOV_MONEY: 'moov_money',
  WAVE: 'wave',
  CARD: 'carte_bancaire',
  CASH: 'especes'
};

const abonnementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur est requis'],
  },
  pressing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pressing',
    required: [true, 'Le pressing est requis'],
    unique: true, // Un seul abonnement actif par pressing
  },
  plan: {
    type: String,
    required: [true, 'Le plan d\'abonnement est requis'],
    enum: Object.values(SUBSCRIPTION_TYPES),
  },
  type: {
    type: String,
    enum: Object.values(SUBSCRIPTION_TYPES),
    required: [true, 'Le type d\'abonnement est requis'],
  },
  status: {
    type: String,
    enum: Object.values(SUBSCRIPTION_STATUS),
    default: SUBSCRIPTION_STATUS.PENDING,
  },
  // Période d'essai
  isTrial: {
    type: Boolean,
    default: false
  },
  trialDays: {
    type: Number,
    default: 30 // 30 jours d'essai gratuit par défaut
  },
  trialStartDate: Date,
  trialEndDate: Date,
  // Période d'abonnement
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: function() {
      return this.type !== SUBSCRIPTION_TYPES.TRIAL;
    },
  },
  nextBillingDate: {
    type: Date,
  },
  // Paiement
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    required: function() {
      return this.type !== SUBSCRIPTION_TYPES.TRIAL;
    },
  },
  paymentMethodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMethod',
  },
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  // Montant et facturation
  amount: {
    type: Number,
    required: [true, 'Le montant de l\'abonnement est requis'],
    min: [0, 'Le montant ne peut pas être négatif'],
  },
  devise: {
    type: String,
    default: 'XOF',
    uppercase: true,
  },
  // Période d'essai (en jours)
  periodeEssaiJours: {
    type: Number,
    default: 30,
    min: [0, 'La période d\'essai ne peut pas être négative'],
  },
  // Billing details
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly', 'one_time'],
    required: true,
    default: 'monthly'
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  // Discounts and promotions
  promotion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promotion'
  },
  discount: {
    amount: Number,
    type: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    description: String
  },
  // Détails du paiement
  paiements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paiement',
  }],
  // Status history
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    reason: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Historique des changements d'abonnement
  historique: [{
    date: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      required: true,
    },
    ancienneValeur: mongoose.Schema.Types.Mixed,
    nouvelleValeur: mongoose.Schema.Types.Mixed,
    raison: String,
    effectuePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  // Configuration des fonctionnalités selon l'abonnement
  fonctionnalites: {
    maxCommandesMois: {
      type: Number,
      default: 100,
    },
    supportPrioritaire: {
      type: Boolean,
      default: false,
    },
    statistiquesAvancees: {
      type: Boolean,
      default: false,
    },
    // Autres fonctionnalités spécifiques
  },
  // Annulation
  annule: {
    type: Boolean,
    default: false,
  },
  dateAnnulation: {
    type: Date,
  },
  raisonAnnulation: {
    type: String,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index pour les recherches courantes
abonnementSchema.index({ pressing: 1, status: 1 });
abonnementSchema.index({ dateFin: 1, status: 1 });

// Méthode pour vérifier si l'abonnement est actif
abonnementSchema.methods.isActive = function() {
  const now = new Date();
  return (
    [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIAL].includes(this.status) &&
    this.startDate <= now &&
    (!this.endDate || this.endDate >= now)
  );
};

// Méthode pour vérifier si l'essai est actif
abonnementSchema.methods.isTrialActive = function() {
  if (!this.isTrial || !this.trialStartDate || !this.trialEndDate) {
    return false;
  }
  
  const now = new Date();
  return (
    this.status === SUBSCRIPTION_STATUS.TRIAL &&
    this.trialStartDate <= now &&
    this.trialEndDate >= now
  );
};

// Méthode pour calculer la date de fin d'abonnement
abonnementSchema.methods.calculateEndDate = function(startDate = this.startDate) {
  if (this.type === SUBSCRIPTION_TYPES.TRIAL) {
    const trialEnd = new Date(startDate);
    trialEnd.setDate(trialEnd.getDate() + (this.trialDays || 30));
    return trialEnd;
  }

  const endDate = new Date(startDate);

  switch (this.billingCycle) {
    case 'monthly':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case 'quarterly':
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case 'yearly':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    // For one_time or custom, use the provided end date
  }

  return endDate;
};

// Méthode pour démarrer l'essai gratuit
abonnementSchema.methods.startTrial = function() {
  if (this.isTrial) {
    const now = new Date();
    this.trialStartDate = now;
    this.trialEndDate = new Date(now);
    this.trialEndDate.setDate(now.getDate() + (this.trialDays || 30));
    this.status = SUBSCRIPTION_STATUS.TRIAL;
    
    // Add to status history
    this.statusHistory = this.statusHistory || [];
    this.statusHistory.push({
      status: SUBSCRIPTION_STATUS.TRIAL,
      date: now,
      reason: 'Démarrage de la période d\'essai gratuite'
    });
    
    return true;
  }
  return false;
};

// Méthode pour activer l'abonnement
abonnementSchema.methods.activate = function(paymentMethod) {
  const now = new Date();
  this.status = SUBSCRIPTION_STATUS.ACTIVE;
  this.startDate = now;
  this.endDate = this.calculateEndDate(now);
  this.nextBillingDate = this.endDate;
  
  if (paymentMethod) {
    this.paymentMethod = paymentMethod.type;
    this.paymentMethodId = paymentMethod._id;
  }
  
  // Add to status history
  this.statusHistory = this.statusHistory || [];
  this.statusHistory.push({
    status: SUBSCRIPTION_STATUS.ACTIVE,
    date: now,
    reason: 'Abonnement activé avec succès'
  });
  
  return true;
};

// Indexes for faster queries
abonnementSchema.index({ user: 1, status: 1 });
abonnementSchema.index({ 'trialEndDate': 1 }, { expireAfterSeconds: 0 });
abonnementSchema.index({ 'endDate': 1 }, { expireAfterSeconds: 0 });

// Pre-save hook to handle status changes
abonnementSchema.pre('save', function(next) {
  const now = new Date();
  
  // Set trial dates if this is a trial subscription
  if (this.isTrial && !this.trialStartDate) {
    this.trialStartDate = now;
    this.trialEndDate = new Date(now);
    this.trialEndDate.setDate(now.getDate() + (this.trialDays || 30));
  }
  
  // Handle status changes
  if (this.isModified('status')) {
    this.statusHistory = this.statusHistory || [];
    this.statusHistory.push({
      status: this.status,
      date: now,
      changedBy: this.user
    });
  }
  
  next();
});

const Abonnement = mongoose.model('Abonnement', abonnementSchema);

module.exports = {
  Abonnement,
  SUBSCRIPTION_TYPES,
  SUBSCRIPTION_STATUS,
  PAYMENT_METHODS
};
