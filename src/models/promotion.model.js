const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const promotionSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  code: {
    type: String,
    uppercase: true,
    trim: true,
    sparse: true, // Allows null for automatic codes
    unique: true  // Ajout de l'index unique directement dans la définition du champ
  },
  type: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed_amount', 'free_trial', 'buy_x_get_y']
  },
  value: {
    type: Number,
    required: function() {
      return this.type !== 'free_trial';
    },
    min: 0
  },
  // For free trial in days
  trialDays: {
    type: Number,
    required: function() {
      return this.type === 'free_trial';
    },
    min: 1
  },
  // For buy x get y type promotions
  buyX: {
    type: Number,
    required: function() {
      return this.type === 'buy_x_get_y';
    },
    min: 1
  },
  getY: {
    type: Number,
    required: function() {
      return this.type === 'buy_x_get_y';
    },
    min: 1
  },
  // Usage limits
  maxUses: {
    type: Number,
    min: 1
  },
  currentUses: {
    type: Number,
    default: 0,
    min: 0
  },
  // Validity period
  validFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: Date,
  // Target criteria
  target: {
    type: {
      type: String,
      enum: ['all', 'new_users', 'existing_users', 'specific_users', 'specific_pressings'],
      default: 'all'
    },
    users: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    pressings: [{
      type: Schema.Types.ObjectId,
      ref: 'Pressing'
    }]
  },
  // Applicable services
  services: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  // Minimum order amount for the promotion to be applicable
  minimumOrderAmount: {
    type: Number,
    min: 0
  },
  // Maximum discount amount (for percentage discounts)
  maximumDiscount: Number,
  // Status
  status: {
    type: String,
    enum: ['active', 'scheduled', 'expired', 'paused', 'deleted'],
    default: 'scheduled'
  },
  // Auto-apply to eligible users
  autoApply: {
    type: Boolean,
    default: false
  },
  // Metadata
  metadata: {
    type: Map,
    of: String
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Pressing',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
// L'index sur le code est maintenant défini dans le schéma
promotionSchema.index({ validFrom: 1, validUntil: 1 });
promotionSchema.index({ status: 1 });

// Virtual for checking if promotion is currently active
promotionSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.validFrom <= now && 
         (!this.validUntil || this.validUntil >= now) &&
         (!this.maxUses || this.currentUses < this.maxUses);
});

// Pre-save hook to generate a random code if not provided
promotionSchema.pre('save', function(next) {
  if (this.isNew && !this.code) {
    // Generate a random 8-character alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.code = code;
  }
  next();
});

module.exports = mongoose.model('Promotion', promotionSchema);
