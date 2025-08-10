const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
  // Référence dynamique selon le type d'utilisateur
  user: {
    id: {
      type: Schema.Types.ObjectId,
      required: true
    },
    type: {
      type: String,
      enum: ['Client', 'Pressing', 'Admin'],
      required: true
    }
  },
  type: {
    type: String,
    required: true,
    enum: ['subscription', 'service', 'refund', 'withdrawal', 'other']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded', 'disputed'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'XOF',
    enum: ['XOF', 'USD', 'EUR']
  },
  paymentMethod: {
    type: Schema.Types.ObjectId,
    ref: 'PaymentMethod',
    required: true
  },
  paymentProvider: {
    type: String,
    required: true,
    enum: ['orange', 'mtn', 'moov', 'wave', 'visa', 'mastercard', 'cash', 'other']
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  providerReference: {
    type: String,
    required: true
  },
  description: String,
  metadata: {
    type: Map,
    of: String
  },
  relatedTo: {
    type: Schema.Types.ObjectId,
    refPath: 'relatedToModel'
  },
  relatedToModel: {
    type: String,
    enum: ['Abonnement', 'Commande', 'Pressing', 'User']
  },
  processedAt: Date,
  failureReason: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
transactionSchema.index({ user: 1, status: 1 });

transactionSchema.index({ providerReference: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', transactionSchema);
