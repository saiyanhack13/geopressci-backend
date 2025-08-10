const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./user.model');

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


// Schéma principal du client (indépendant)
const clientMainSchema = new mongoose.Schema({
  // Champs de base (anciennement hérités de User)
  nom: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
  },
  prenom: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Veuillez entrer un email valide'],
  },
  phone: {
    type: String,
    required: [true, 'Le numéro de téléphone est requis'],
    trim: true,
    match: [/^\+?[0-9]{10,15}$/, 'Numéro de téléphone invalide'],
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
    select: false,
  },
  role: {
    type: String,
    enum: ['client', 'pressing', 'admin'],
    default: 'client',
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  // Ajouter les champs spécifiques du client
  ...clientSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index géospatial
clientMainSchema.index({ 'lastLocation': '2dsphere' });

// Méthodes de mot de passe (anciennement héritées de User)
clientMainSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour obtenir les informations publiques
clientMainSchema.methods.getPublicProfile = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Création du modèle Client comme modèle indépendant pour la collection 'clients'
// Plus de discriminator - architecture corrigée avec collections séparées
let Client;
try {
  // Essayer de récupérer le modèle s'il existe déjà
  Client = mongoose.model('Client');
} catch (e) {
  // Si le modèle n'existe pas, le créer comme modèle indépendant
  // Pointer explicitement vers la collection 'clients'
  Client = mongoose.model('Client', clientMainSchema, 'clients');
}

module.exports = Client;
