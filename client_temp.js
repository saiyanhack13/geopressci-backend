const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { userSchema } = require('./src/models/user.model');

// Schéma pour les adresses
const addressSchema = new mongoose.Schema({
  type: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
  label: { type: String, trim: true, maxlength: 50 },
  street: { type: String, required: true, trim: true },
  complement: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  district: { type: String, trim: true },
  postalCode: { type: String, required: true, trim: true },
  country: { type: String, default: 'Côte d\'Ivoire', trim: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(v) {
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && 
                 v[1] >= -90 && v[1] <= 90;
        },
        message: 'Coordonnées de localisation invalides'
      }
    },
    formattedAddress: String,
    placeId: String
  },
  isDefault: { type: Boolean, default: false },
  deliveryInstructions: { type: String, trim: true, maxlength: 500 },
  metadata: mongoose.Schema.Types.Mixed
}, { _id: false });

// Schéma Client simplifié
const clientSchema = new mongoose.Schema({
  // Champs de base de l'utilisateur
  ...userSchema.obj,
  
  // Informations spécifiques au client
  phone: {
    type: String,
    required: [true, 'Le numéro de téléphone est requis'],
    match: [/^[0-9]{10,15}$/, 'Numéro de téléphone invalide'],
    index: true
  },
  
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(v) {
        const minAgeDate = new Date();
        minAgeDate.setFullYear(minAgeDate.getFullYear() - 13);
        return v <= minAgeDate;
      },
      message: 'Vous devez avoir au moins 13 ans pour vous inscrire'
    }
  },
  
  // Adresses
  addresses: [addressSchema],
  
  // Dernière localisation
  derniereLocalisation: {
    type: { type: String, enum: ['Point'] },
    coordinates: {
      type: [Number],
      validate: {
        validator: function(v) {
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && 
                 v[1] >= -90 && v[1] <= 90;
        },
        message: 'Coordonnées de localisation invalides'
      }
    }
  },
  
  // Statut du compte
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'suspendu'],
    default: 'actif'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index géospatial pour les recherches de proximité
clientSchema.index({ 'derniereLocalisation': '2dsphere' });

// Middleware pour s'assurer que le rôle est bien 'client'
clientSchema.pre('save', function (next) {
  this.role = 'client';
  next();
});

// Création du modèle Client
const Client = mongoose.model('Client', clientSchema);

module.exports = Client;
