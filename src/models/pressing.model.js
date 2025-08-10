const mongoose = require('mongoose');

// Définition des constantes
const ID_VERIFICATION_STATUS = {
  PENDING: 'en_attente',
  APPROVED: 'approuve',
  REJECTED: 'rejete',
  NOT_SUBMITTED: 'non_soumis'
};

const SUBSCRIPTION_PLANS = {
  TRIAL: 'essai',
  MONTHLY: 'mensuel',
  YEARLY: 'annuel',
};

const SERVICE_CATEGORIES = {
  LAVAGE: 'lavage',
  REPASSAGE: 'repassage',
  NETTOYAGE_SEC: 'nettoyage_sec',
  RETOUCHE: 'retouche',
  AUTRE: 'autre'
};

const DAYS_OF_WEEK = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// Schéma pour les horaires d'ouverture
const businessHoursSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: DAYS_OF_WEEK,
    required: true
  },
  open: {
    type: String,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    required: true
  },
  close: {
    type: String,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    required: true
  },
  isClosed: {
    type: Boolean,
    default: false
  }
});

// Schéma pour les services proposés
const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du service est requis'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Le prix est requis'],
    min: 0
  },
  category: {
    type: String,
    enum: Object.values(SERVICE_CATEGORIES),
    required: [true, 'La catégorie du service est requise']
  },
  duration: {
    type: Number,
    required: [true, 'La durée estimée est requise (en minutes)'],
    min: 1
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  minOrderQuantity: {
    type: Number,
    default: 1,
    min: 1
  },
  maxOrderQuantity: {
    type: Number,
    min: 1
  },
  preparationTime: {
    type: Number, // en heures
    default: 24
  }
});

// Schéma pour les options de livraison
const deliveryOptionsSchema = new mongoose.Schema({
  isAvailable: {
    type: Boolean,
    default: false
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: 0
  },
  freeDeliveryThreshold: {
    type: Number,
    min: 0
  },
  deliveryRadius: {
    type: Number, // en kilomètres
    default: 5,
    min: 1
  },
  estimatedDeliveryTime: {
    type: String,
    default: '30-45 min'
  },
  minOrderAmount: {
    type: Number,
    default: 0
  }
});

// Schéma pour les photos du pressing
const photoSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'L\'URL de la photo est requise']
  },
  publicId: {
    type: String,
    required: [true, 'Le public ID Cloudinary est requis']
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  caption: {
    type: String,
    trim: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Schéma principal du pressing
const pressingSchema = new mongoose.Schema(
  {
    // Informations personnelles (héritées de User)
    nom: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    prenom: {
      type: String,
      required: [true, 'Le prénom est requis'],
      trim: true,
      maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    email: {
      type: String,
      required: [true, 'L\'email est requis'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Adresse email invalide']
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est requis'],
      minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères']
    },
    phone: {
      type: String,
      required: [true, 'Le numéro de téléphone est requis'],
      match: [/^\+?[0-9]{10,15}$/, 'Numéro de téléphone invalide']
    },
    role: {
      type: String,
      default: 'pressing',
      enum: ['pressing', 'Pressing'] // Support legacy data with capital P
    },
    
    // Informations business
    businessName: {
      type: String,
      required: [true, 'Le nom du pressing est requis'],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
    },
    
    // Contact business
    businessPhone: {
      type: String,
      required: false,
      match: [/^\+?[0-9]{10,15}$/, 'Numéro de téléphone invalide']
    },
    website: {
      type: String,
      trim: true,
      match: [/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/, 'URL de site web invalide']
    },
    
    // Localisation
    address: {
      street: {
        type: String,
        required: [true, 'La rue est requise'],
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
      coordinates: {
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
        }
      },
      formattedAddress: String,
      placeId: String // ID de l'emplacement Google Places
    },
    
    // Horaires d'ouverture
    businessHours: [businessHoursSchema],
    
    // Jours fériés et fermetures exceptionnelles
    holidays: [{
      date: Date,
      name: String,
      isClosed: {
        type: Boolean,
        default: true
      },
      specialHours: {
        open: String,
        close: String
      }
    }],
    
    // Services proposés
    services: [serviceSchema],
    
    // Options de livraison
    deliveryOptions: deliveryOptionsSchema,
    
    // Médias
    photos: [photoSchema],
    profilePhoto: {
      url: {
        type: String,
        trim: true
      },
      publicId: {
        type: String,
        trim: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    },
    coverPhoto: {
      url: {
        type: String,
        trim: true
      },
      publicId: {
        type: String,
        trim: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    },
    logo: {
      type: String,
      trim: true
    },
    
    // Évaluations et notes
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      count: {
        type: Number,
        default: 0,
        min: 0
      },
      totalScore: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    
    // Abonnement et statut
    subscription: {
      plan: {
        type: String,
        enum: Object.values(SUBSCRIPTION_PLANS),
        default: SUBSCRIPTION_PLANS.TRIAL
      },
      status: {
        type: String,
        enum: ['active', 'trialing', 'past_due', 'canceled', 'unpaid'],
        default: 'trialing'
      },
      startDate: {
        type: Date,
        default: Date.now
      },
      endDate: {
        type: Date,
        default: () => new Date(+new Date() + 30*24*60*60*1000) // 30 jours d'essai
      },
      autoRenew: {
        type: Boolean,
        default: false
      },
      paymentMethod: {
        type: String,
        enum: ['mobile_money', 'credit_card', 'bank_transfer', null],
        default: null
      }
    },
    
    // Vérification d'identité
    verification: {
      status: {
        type: String,
        enum: Object.values(ID_VERIFICATION_STATUS),
        default: ID_VERIFICATION_STATUS.NOT_SUBMITTED
      },
      documents: [{
        type: {
          type: String,
          enum: ['cni', 'passport', 'business_license', 'tax_id', 'other']
        },
        url: String,
        verified: {
          type: Boolean,
          default: false
        },
        rejectionReason: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }],
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      rejectionReason: String
    },
    
    // Paramètres de l'application
    settings: {
      notifications: {
        email: {
          type: Boolean,
          default: true
        },
        sms: {
          type: Boolean,
          default: true
        },
        push: {
          type: Boolean,
          default: true
        }
      },
      minOrderValue: {
        type: Number,
        default: 0
      },
      orderLeadTime: {
        type: Number, // en heures
        default: 2
      },
      preparationTime: {
        standard: {
          type: Number, // en heures
          default: 24
        },
        express: {
          type: Number, // en heures
          default: 6
        }
      },
      paymentMethods: [{
        type: String,
        enum: ['cash', 'mobile_money', 'credit_card', 'bank_transfer']
      }]
    },
    
    // Statistiques
    stats: {
      totalOrders: {
        type: Number,
        default: 0
      },
      completedOrders: {
        type: Number,
        default: 0
      },
      totalRevenue: {
        type: Number,
        default: 0
      },
      averageOrderValue: {
        type: Number,
        default: 0
      },
      lastOrderDate: Date
    },
    
    // Réseaux sociaux
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String,
      whatsapp: String
    },
    
    // Plus besoin de référence owner - le pressing est autonome
    
    // Statut
    isActive: {
      type: Boolean,
      default: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    
    // Métadonnées
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  });

// Index pour les recherches géospatiales
pressingSchema.index({ 'address.coordinates': '2dsphere' });

// Index pour les recherches textuelles
pressingSchema.index(
  { 
    'businessName': 'text',
    'description': 'text',
    'address.street': 'text',
    'address.city': 'text',
    'address.district': 'text'
  },
  {
    weights: {
      businessName: 10,
      'address.district': 8,
      'address.city': 6,
      'address.street': 4,
      description: 2
    },
    name: 'pressing_search_index'
  }
);

// Index pour les requêtes courantes
pressingSchema.index({ 'subscription.status': 1, 'isActive': 1 });

// Méthode pour vérifier si le pressing est ouvert
pressingSchema.methods.isOpen = function() {
  const now = new Date();
  const dayOfWeek = DAYS_OF_WEEK[now.getDay()];
  const todayHours = this.businessHours.find(h => h.day === dayOfWeek);
  
  if (!todayHours || todayHours.isClosed) {
    return false;
  }
  
  const [openHour, openMinute] = todayHours.open.split(':').map(Number);
  const [closeHour, closeMinute] = todayHours.close.split(':').map(Number);
  
  const openTime = new Date(now);
  openTime.setHours(openHour, openMinute, 0, 0);
  
  const closeTime = new Date(now);
  closeTime.setHours(closeHour, closeMinute, 0, 0);
  
  return now >= openTime && now <= closeTime;
};

// Méthode pour calculer la distance entre le pressing et un point
pressingSchema.methods.calculateDistance = function(lat, lng) {
  if (!this.address?.coordinates?.length === 2) return null;
  
  const R = 6371; // Rayon de la Terre en km
  const dLat = this.deg2rad(lat - this.address.coordinates[1]);
  const dLon = this.deg2rad(lng - this.address.coordinates[0]);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.deg2rad(this.address.coordinates[1])) * Math.cos(this.deg2rad(lat)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance en km
};

// Méthode utilitaire pour la conversion degrés -> radians
pressingSchema.methods.deg2rad = function(deg) {
  return deg * (Math.PI / 180);
};

// Middleware pour formater l'adresse avant la sauvegarde
pressingSchema.pre('save', async function(next) {
  if (this.isModified('address') && this.address) {
    // Mettre à jour l'adresse formatée si nécessaire
    if (!this.address.formattedAddress) {
      const { street, city, postalCode, country } = this.address;
      this.address.formattedAddress = `${street}, ${postalCode} ${city}, ${country}`;
    }
    
    // Vérifier si les coordonnées ont changé
    if (this.address.coordinates && this.address.coordinates.length === 2) {
      this.address.coordinates = [
        parseFloat(this.address.coordinates[0].toFixed(6)),
        parseFloat(this.address.coordinates[1].toFixed(6))
      ];
    }
  }
  
  // Mettre à jour la date de fin d'abonnement pour les nouveaux essais
  if (this.isNew && this.subscription?.status === 'trialing' && !this.subscription.endDate) {
    this.subscription.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours d'essai
  }
  
  next();
});

// Méthode statique pour trouver les pressings à proximité
pressingSchema.statics.findNearby = async function(lng, lat, maxDistance = 10) {
  const collection = this.collection;
  
  const pipeline = [
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)]
        },
        distanceField: 'distance',
        maxDistance: maxDistance * 1000, // Conversion en mètres
        spherical: true,
        key: 'address.coordinates',
        query: {
          'role': 'pressing', // Corriger pour utiliser minuscule
          'isActive': true,
          'subscription.status': { $in: ['active', 'trialing'] }
        }
      }
    },
    {
      $project: {
        services: 0,
        photos: 0,
        password: 0
      }
    }
  ];
  
  return await collection.aggregate(pipeline).toArray();
};

// Méthode pour mettre à jour la note moyenne
pressingSchema.methods.updateRating = async function() {
  const Review = mongoose.model('Review');
  
  const result = await Review.aggregate([
    { $match: { pressing: this._id } },
    { 
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 },
        totalScore: { $sum: "$rating" }
      }
    }
  ]);
  
  if (result.length > 0) {
    this.rating = {
      average: parseFloat(result[0].average.toFixed(1)),
      count: result[0].count,
      totalScore: result[0].totalScore
    };
  } else {
    this.rating = {
      average: 0,
      count: 0,
      totalScore: 0
    };
  }
  
  return this.save();
};


// Middleware pour hacher le mot de passe avant sauvegarde
const bcrypt = require('bcryptjs');

pressingSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les mots de passe
pressingSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode statique pour trouver les pressings à proximité
pressingSchema.statics.findNearby = async function(lng, lat, maxDistance = 10) {
  const pipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'distance',
        maxDistance: maxDistance * 1000, // Convertir km en mètres
        spherical: true,
        key: 'address.coordinates',
        query: { 
          'isActive': true, 
          'subscription.status': { $in: ['active', 'trialing'] }
        }
      }
    },
    {
      $project: {
        password: 0 // Exclure le mot de passe
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

// Index géospatial pour les requêtes de proximité
pressingSchema.index({ 'address.coordinates': '2dsphere' });

// Créer le modèle avec sa propre collection
const Pressing = mongoose.model('Pressing', pressingSchema, 'pressings');

module.exports = Pressing;
