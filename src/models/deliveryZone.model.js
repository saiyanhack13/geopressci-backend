const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema(
  {
    // Référence au pressing propriétaire
    pressing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pressing',
      required: [true, 'La référence au pressing est requise']
    },
    
    // Nom de la zone (ex: "Cocody", "Plateau", etc.)
    name: {
      type: String,
      required: [true, 'Le nom de la zone est requis'],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
    },
    
    // Frais de livraison pour cette zone
    deliveryFee: {
      type: Number,
      required: [true, 'Les frais de livraison sont requis'],
      min: [0, 'Les frais de livraison ne peuvent pas être négatifs']
    },
    
    // Montant minimum de commande pour cette zone
    minOrder: {
      type: Number,
      required: [true, 'Le montant minimum de commande est requis'],
      min: [0, 'Le montant minimum ne peut pas être négatif']
    },
    
    // Zone géographique (optionnel pour l'avenir)
    coordinates: [{
      lat: {
        type: Number,
        min: [-90, 'Latitude invalide'],
        max: [90, 'Latitude invalide']
      },
      lng: {
        type: Number,
        min: [-180, 'Longitude invalide'],
        max: [180, 'Longitude invalide']
      }
    }],
    
    // Temps de livraison estimé (en minutes)
    estimatedDeliveryTime: {
      type: Number,
      default: 45,
      min: [1, 'Le temps de livraison doit être positif']
    },
    
    // Description ou notes sur la zone
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
    },
    
    // Statut actif/inactif
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Ordre d'affichage
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index composé pour éviter les doublons (pressing + nom de zone)
deliveryZoneSchema.index({ pressing: 1, name: 1 }, { unique: true });

// Index pour les requêtes par pressing
deliveryZoneSchema.index({ pressing: 1, isActive: 1, sortOrder: 1 });

// Middleware pour normaliser le nom de la zone
deliveryZoneSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    // Capitaliser la première lettre et normaliser
    this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase();
  }
  next();
});

// Méthode statique pour récupérer les zones d'un pressing
deliveryZoneSchema.statics.findByPressing = function(pressingId, activeOnly = true) {
  const query = { pressing: pressingId };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query).sort({ sortOrder: 1, name: 1 });
};

// Méthode pour vérifier si une zone couvre un montant de commande
deliveryZoneSchema.methods.canDeliver = function(orderAmount) {
  return this.isActive && orderAmount >= this.minOrder;
};

// Méthode pour calculer le coût total avec livraison
deliveryZoneSchema.methods.calculateTotal = function(orderAmount) {
  if (!this.canDeliver(orderAmount)) {
    return null;
  }
  return orderAmount + this.deliveryFee;
};

const DeliveryZone = mongoose.model('DeliveryZone', deliveryZoneSchema);

module.exports = DeliveryZone;
