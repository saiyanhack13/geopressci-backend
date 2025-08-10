const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const payoutSchema = new Schema({
  pressing: {
    type: Schema.Types.ObjectId,
    ref: 'Pressing',
    required: true
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
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['mobile_money', 'bank_transfer', 'wave']
  },
  paymentDetails: {
    // For mobile money
    phoneNumber: String,
    // For bank transfer
    accountNumber: String,
    accountName: String,
    bankName: String,
    // For Wave
    waveId: String
  },
  transactions: [{
    type: Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  reference: {
    type: String,
    required: true,
    unique: true
  },
  processedAt: Date,
  completedAt: Date,
  failureReason: String,
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
payoutSchema.index({ pressing: 1, status: 1 });


module.exports = mongoose.model('Payout', payoutSchema);
