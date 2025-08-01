const mongoose = require('mongoose');
const { User, userSchema } = require('./user.model');

// Schéma pour les adresses
const addressSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['home', 'work', 'other'], 
    default: 'home' 
  },
  label: { 
    type: String, 
    trim: true, 
    maxlength: 50 
  },
  street: { 
    type: String, 
    required: [true, 'La rue est requise'], 
    trim: true 
  },
  complement: { 
    type: String, 
    trim: true 
  },
  city: { 
    type: String, 
    required: [true, 'La ville est requise'], 
    trim: true 
  },
  district: { 
    type: String, 
    trim: true 
  },
  postalCode: { 
    type: String, 
    required: [true, 'Le code postal est requis'], 
    trim: true 
  },
  country: { 
    type: String, 
    default: 'Côte d\'Ivoire', 
    trim: true 
  },
  location: {
    type: { 
      type: String, 
      enum: ['Point'], 
      default: 'Point' 
    },
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
  isDefault: { 
    type: Boolean, 
    default: false 
  },
  deliveryInstructions: { 
    type: String, 
    trim: true, 
    maxlength: 500 
  }
}, { _id: false });

// Schéma Client simplifié
const clientSchema = new mongoose.Schema({

  
  // Informations spécifiques au client
  
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
  lastLocation: {
    type: { 
      type: String, 
      enum: ['Point'] 
    },
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
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index géospatiaux pour les recherches de proximité
clientSchema.index({ 'addresses.location': '2dsphere' });
clientSchema.index({ 'lastLocation': '2dsphere' });


// Création du modèle Client en tant que discriminateur de User
const Client = User.discriminator('Client', clientSchema);

module.exports = Client;
