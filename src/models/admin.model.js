const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/config');

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Veuillez entrer un email valide']
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false // Ne pas renvoyer le mot de passe par défaut
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  lastLogin: {
    type: Date
  },
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  permissions: [{
    type: String,
    enum: [
      'manage_pressings', 
      'manage_subscriptions', 
      'manage_payments', 
      'manage_users',
      'view_analytics',
      'manage_content',
      'system_settings'
    ]
  }],
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'active'
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpire: {
    type: Date,
    select: false
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.twoFactorSecret;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpire;
      return ret;
    }
  }
});

// Hacher le mot de passe avant de sauvegarder
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour vérifier le mot de passe
adminSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Méthode pour générer un token de réinitialisation
adminSchema.methods.getResetPasswordToken = function() {
  // Générer un token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hasher le token et le sauvegarder
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Définir la date d'expiration (30 minutes)
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;

  return resetToken;
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
