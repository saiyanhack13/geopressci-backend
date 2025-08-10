const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const paymentMethodSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['mobile_money', 'card', 'wave'],
    default: 'mobile_money'
  },
  provider: {
    type: String,
    required: true,
    enum: ['orange', 'mtn', 'moov', 'wave', 'visa', 'mastercard', 'other'],
    default: 'orange'
  },
  // For mobile money
  phoneNumber: {
    type: String,
    required: function() {
      return this.type === 'mobile_money' || this.type === 'wave';
    }
  },
  // For cards
  cardLast4: {
    type: String,
    required: function() {
      return this.type === 'card';
    }
  },
  cardBrand: {
    type: String,
    required: function() {
      return this.type === 'card';
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // Store provider-specific reference
  providerReference: {
    type: String,
    required: true
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
paymentMethodSchema.index({ user: 1, isDefault: 1 });

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
