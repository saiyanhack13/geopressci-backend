const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userType: {
    type: String,
    required: true,
    enum: ['client', 'pressing', 'admin'],
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  keys: {
    p256dh: {
      type: String,
      required: true
    },
    auth: {
      type: String,
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now,
    index: true
  },
  userAgent: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index composé pour optimiser les requêtes
pushSubscriptionSchema.index({ userId: 1, isActive: 1 });
pushSubscriptionSchema.index({ userType: 1, isActive: 1 });
pushSubscriptionSchema.index({ lastUsed: 1, isActive: 1 });

// Middleware pour nettoyer automatiquement les subscriptions expirées
pushSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Méthode statique pour nettoyer les subscriptions inactives
pushSubscriptionSchema.statics.cleanupInactive = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    $or: [
      { isActive: false },
      { lastUsed: { $lt: cutoffDate } }
    ]
  });
};

// Méthode d'instance pour marquer comme inactive
pushSubscriptionSchema.methods.markInactive = function() {
  this.isActive = false;
  return this.save();
};

// Méthode d'instance pour mettre à jour la dernière utilisation
pushSubscriptionSchema.methods.updateLastUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
