const mongoose = require('mongoose');

// Schéma pour les actions de notification
const notificationActionSchema = new mongoose.Schema({
  // Type d'action (ex: 'view_order', 'go_to_settings', 'rate_service')
  type: {
    type: String,
    required: [true, 'Le type d\'action est requis'],
    trim: true,
    index: true
  },
  // Libellé de l'action affiché à l'utilisateur
  label: {
    type: String,
    required: [true, 'Le libellé de l\'action est requis'],
    trim: true
  },
  // URL ou route de destination
  target: {
    type: String,
    required: [true, 'La cible de l\'action est requise'],
    trim: true
  },
  // Données supplémentaires pour le traitement de l'action
  metadata: mongoose.Schema.Types.Mixed
}, { _id: false });

// Schéma principal de notification
const notificationSchema = new mongoose.Schema(
  {
    // Référence au destinataire (client, pressing ou admin)
    recipient: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'L\'ID du destinataire est requis'],
        index: true
      },
      type: {
        type: String,
        enum: ['Client', 'Pressing', 'Admin'],
        required: [true, 'Le type de destinataire est requis']
      }
    },

    // Type de notification (système, commande, promotion, etc.)
    type: {
      type: String,
      required: [true, 'Le type de notification est requis'],
      enum: [
        'system',           // Messages système (mises à jour, maintenance, etc.)
        'order',            // Mises à jour de commande
        'promotion',        // Offres promotionnelles
        'account',          // Activité du compte (connexions, modifications)
        'review',           // Avis et évaluations
        'payment',          // Notifications de paiement
        'delivery',         // Mises à jour de livraison
        'subscription',     // Abonnements et renouvellements
        'admin'             // Messages de l'administration
      ],
      index: true
    },

    // Sous-type pour une catégorisation plus fine
    subtype: {
      type: String,
      trim: true,
      index: true
    },

    // Titre de la notification
    title: {
      type: String,
      required: [true, 'Le titre de la notification est requis'],
      trim: true,
      maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères']
    },

    // Contenu de la notification
    message: {
      type: String,
      required: [true, 'Le message de la notification est requis'],
      trim: true,
      maxlength: [1000, 'Le message ne peut pas dépasser 1000 caractères']
    },

    // Données supplémentaires (peut contenir des informations structurées)
    data: mongoose.Schema.Types.Mixed,

    // Actions possibles pour cette notification
    actions: [notificationActionSchema],

    // URL de l'image ou de l'icône (optionnelle)
    imageUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\//.test(v);
        },
        message: 'L\'URL de l\'image doit commencer par http:// ou https://'
      }
    },

    // Niveau de priorité (1-5, 5 étant le plus élevé)
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },

    // Date d'expiration de la notification
    expiresAt: {
      type: Date
      // L'index TTL sera créé explicitement plus bas pour éviter les doublons
    },

    // Statut de la notification
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending',
      index: true
    },

    // Canaux d'envoi
    channels: {
      inApp: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: false
      },
      sms: {
        type: Boolean,
        default: false
      },
      push: {
        type: Boolean,
        default: false
      }
    },

    // Suivi des envois
    delivery: {
      inApp: {
        sentAt: Date,
        deliveredAt: Date,
        readAt: Date,
        error: String
      },
      email: {
        sentAt: Date,
        deliveredAt: Date,
        openedAt: Date,
        error: String,
        messageId: String
      },
      sms: {
        sentAt: Date,
        deliveredAt: Date,
        error: String,
        messageId: String
      },
      push: {
        sentAt: Date,
        deliveredAt: Date,
        openedAt: Date,
        error: String,
        messageId: String
      }
    },

    // Métadonnées de l'appareil/utilisateur au moment de la réception
    metadata: {
      device: {
        type: String,
        enum: ['ios', 'android', 'web', 'unknown'],
        default: 'unknown'
      },
      appVersion: String,
      osVersion: String,
      ipAddress: String,
      userAgent: String,
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: [Number] // [longitude, latitude]
      }
    },

    // Liens vers d'autres entités (commande, utilisateur, etc.)
    relatedTo: {
      order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      },
      client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client'
      },
      pressing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pressing'
      },
      review: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
      },
      // Autres références possibles
      targetId: mongoose.Schema.Types.ObjectId,
      targetType: String
    },

    // Paramètres d'envoi
    sendOptions: {
      // Délai avant envoi (en secondes)
      delay: {
        type: Number,
        default: 0
      },
      // Heure d'envoi programmée
      scheduledAt: {
        type: Date,
        index: true
      },
      // Ne pas envoyer avant cette date/heure
      notBefore: {
        type: Date,
        index: true
      },
      // Ne pas envoyer après cette date/heure
      notAfter: {
        type: Date,
        index: true
      },
      // Tentatives d'envoi
      retryCount: {
        type: Number,
        default: 0,
        max: 5
      },
      // Dernière tentative d'envoi
      lastRetryAt: Date,
      // Prochaine tentative programmée
      nextRetryAt: {
        type: Date,
        index: true
      },
      // Stratégie de réessai (en secondes)
      retryStrategy: [{
        type: Number,
        default: [0, 60, 300, 1800, 3600, 14400] // 1min, 5min, 30min, 1h, 4h
      }]
    },

    // Personnalisation
    customFields: mongoose.Schema.Types.Mixed,

    // Balises pour le filtrage
    tags: [{
      type: String,
      trim: true,
      index: true
    }],

    // Métadonnées techniques
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index pour les requêtes courantes
notificationSchema.index({ user: 1, status: 1, createdAt: -1 });
notificationSchema.index({ 'relatedTo.order': 1 });
notificationSchema.index({ 'relatedTo.pressing': 1 });
notificationSchema.index({ type: 1, status: 1, 'sendOptions.scheduledAt': 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Middleware pour gérer les dates d'expiration
notificationSchema.pre('save', function(next) {
  // Si pas de date d'expiration, définir une expiration par défaut (30 jours)
  if (!this.expiresAt) {
    const defaultExpiration = new Date();
    defaultExpiration.setDate(defaultExpiration.getDate() + 30);
    this.expiresAt = defaultExpiration;
  }
  
  // Si la notification est marquée comme lue, mettre à jour la date de lecture
  if (this.isModified('status') && this.status === 'read' && !this.delivery.inApp.readAt) {
    this.delivery.inApp.readAt = new Date();
  }
  
  next();
});

// Méthodes statiques
notificationSchema.statics.markAsRead = async function(notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { 
      'status': 'read',
      'delivery.inApp.readAt': new Date()
    },
    { new: true }
  );
};

// Méthodes d'instance
notificationSchema.methods.retry = async function() {
  if (this.status !== 'failed' || this.sendOptions.retryCount >= this.sendOptions.retryStrategy.length) {
    return false;
  }
  
  const now = new Date();
  const retryDelay = this.sendOptions.retryStrategy[this.sendOptions.retryCount];
  const nextRetry = new Date(now.getTime() + retryDelay * 1000);
  
  this.sendOptions.retryCount += 1;
  this.sendOptions.lastRetryAt = now;
  this.sendOptions.nextRetryAt = nextRetry;
  this.status = 'pending';
  
  await this.save();
  return true;
};

// Méthode pour envoyer la notification
notificationSchema.methods.send = async function() {
  // Cette méthode serait implémentée dans le service de notification
  // Elle gérerait l'envoi via les différents canaux configurés
  
  // Exemple simplifié :
  try {
    // Mettre à jour le statut d'envoi
    this.status = 'sent';
    this.delivery.inApp.sentAt = new Date();
    
    // Ici, on appellerait les services d'envoi appropriés
    // en fonction des canaux activés
    
    // Exemple pour l'email
    if (this.channels.email) {
      this.delivery.email.sentAt = new Date();
      // Appel au service d'email...
    }
    
    // Exemple pour les SMS
    if (this.channels.sms) {
      this.delivery.sms.sentAt = new Date();
      // Appel au service SMS...
    }
    
    // Exemple pour les notifications push
    if (this.channels.push) {
      this.delivery.push.sentAt = new Date();
      // Appel au service de notifications push...
    }
    
    await this.save();
    return true;
  } catch (error) {
    this.status = 'failed';
    this.delivery.error = error.message;
    await this.save();
    return false;
  }
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
