const mongoose = require('mongoose');

// Statuts de paiement
const PAYMENT_STATUS = {
  PENDING: 'en_attente',
  COMPLETED: 'complete',
  FAILED: 'echoue',
  REFUNDED: 'rembourse',
  PARTIALLY_REFUNDED: 'partiellement_rembourse',  
  CANCELED: 'annule',
};

// Méthodes de paiement
const PAYMENT_METHODS = {
  CASH: 'espece',
  MOBILE_MONEY: 'mobile_money',
  CREDIT_CARD: 'carte_credit',
  BANK_TRANSFER: 'virement_bancaire',
  OTHER: 'autre',
};

// Types de transaction
const TRANSACTION_TYPES = {
  SUBSCRIPTION: 'abonnement',
  ORDER_PAYMENT: 'commande',
  REFUND: 'remboursement',
  DEPOSIT: 'acompte',
  OTHER: 'autre',
};

const paiementSchema = new mongoose.Schema({
  // Référence à l'utilisateur (client ou pressing)
  utilisateur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur est requis'],
  },
  // Référence à la commande ou à l'abonnement
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceType',
  },
  // Type de référence (Commande ou Abonnement)
  referenceType: {
    type: String,
    enum: ['Commande', 'Abonnement'],
    required: [true, 'Le type de référence est requis'],
  },
  // Détails du paiement
  montant: {
    type: Number,
    required: [true, 'Le montant est requis'],
    min: [0, 'Le montant ne peut pas être négatif'],
  },
  devise: {
    type: String,
    default: 'XOF',
    uppercase: true,
  },
  frais: {
    type: Number,
    default: 0,
    min: [0, 'Les frais ne peuvent pas être négatifs'],
  },
  montantNet: {
    type: Number,
    required: [true, 'Le montant net est requis'],
  },
  // Informations de la transaction
  transactionId: {
    type: String,
    unique: true,
    sparse: true,
  },
  methode: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    required: [true, 'La méthode de paiement est requise'],
  },
  type: {
    type: String,
    enum: Object.values(TRANSACTION_TYPES),
    required: [true, 'Le type de transaction est requis'],
  },
  statut: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING,
  },
  // Détails spécifiques au mobile money
  mobileMoneyDetails: {
    operateur: {
      type: String,
      enum: ['mtn', 'orange', 'moov', 'wave'],
    },
    numero: String,
    transactionId: String,
  },
  // Détails de la carte de crédit (cryptés)
  cardDetails: {
    last4: String,
    brand: String,
    country: String,
    expMonth: Number,
    expYear: Number,
  },
  // Dates importantes
  datePaiement: {
    type: Date,
    default: Date.now,
  },
  dateValidation: {
    type: Date,
  },
  // Remarques et métadonnées
  remarques: String,
  metadata: {
    type: Map,
    of: String,
  },
  // Paiement récurrent
  estRecurrent: {
    type: Boolean,
    default: false,
  },
  factureId: String,
  // En cas d'échec
  echec: {
    raison: String,
    codeErreur: String,
    messageErreur: String,
    dateEchec: Date,
    tentatives: {
      type: Number,
      default: 0,
    },
  },
  // Pour les remboursements
  remboursement: {
    montantRembourse: Number,
    dateRemboursement: Date,
    motif: String,
    referenceRemboursement: String,
  },
  // Traçabilité
  creePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  modifiePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index pour les recherches courantes
paiementSchema.index({ utilisateur: 1, statut: 1 });
paiementSchema.index({ reference: 1, referenceType: 1 });

paiementSchema.index({ datePaiement: -1 });

// Middleware pour calculer le montant net avant sauvegarde
paiementSchema.pre('save', function(next) {
  if (this.isModified('montant') || this.isModified('frais')) {
    this.montantNet = this.montant - (this.frais || 0);
  }
  
  if (this.isNew && !this.datePaiement) {
    this.datePaiement = new Date();
  }
  
  next();
});

const Paiement = mongoose.model('Paiement', paiementSchema);

module.exports = {
  Paiement,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
};
