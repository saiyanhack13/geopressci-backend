const mongoose = require('mongoose');

const avisSchema = new mongoose.Schema({
  // Référence à la commande (optionnel mais recommandé)
  commande: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    index: true,
  },
  // Client qui a laissé l'avis
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Le client est requis'],
    index: true,
  },
  // Pressing évalué
  pressing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pressing',
    required: [true, 'Le pressing est requis'],
    index: true,
  },
  // Service évalué (optionnel)
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
  },
  // Note globale (sur 5 étoiles)
  note: {
    type: Number,
    required: [true, 'La note est requise'],
    min: [1, 'La note minimale est 1'],
    max: [5, 'La note maximale est 5'],
  },
  // Détails de l'évaluation (sous-catégories)
  details: {
    qualite: {
      type: Number,
      min: [1, 'La note minimale est 1'],
      max: [5, 'La note maximale est 5'],
    },
    rapidite: {
      type: Number,
      min: [1, 'La note minimale est 1'],
      max: [5, 'La note maximale est 5'],
    },
    accueil: {
      type: Number,
      min: [1, 'La note minimale est 1'],
      max: [5, 'La note maximale est 5'],
    },
    rapportQualitePrix: {
      type: Number,
      min: [1, 'La note minimale est 1'],
      max: [5, 'La note maximale est 5'],
    },
  },
  // Commentaire
  commentaire: {
    type: String,
    trim: true,
    maxlength: [1000, 'Le commentaire ne peut pas dépasser 1000 caractères'],
  },
  // Photos (URLs vers les images)
  photos: [{
    url: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
  }],
  // Réponse du pressing (optionnelle)
  reponse: {
    contenu: {
      type: String,
      trim: true,
      maxlength: [1000, 'La réponse ne peut pas dépasser 1000 caractères'],
    },
    date: {
      type: Date,
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  // Statut de modération
  statut: {
    type: String,
    enum: ['en_attente', 'approuve', 'rejete'],
    default: 'en_attente',
  },
  // Raison du rejet (si rejeté)
  raisonRejet: {
    type: String,
    trim: true,
  },
  // Métadonnées
  ip: {
    type: String,
    select: false,
  },
  userAgent: {
    type: String,
    select: false,
  },
  // Pour les avis anonymes
  anonyme: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index pour les recherches courantes
avisSchema.index({ pressing: 1, statut: 1 });
avisSchema.index({ client: 1, pressing: 1 }, { unique: [true, 'Un client ne peut laisser qu\'un seul avis par pressing'] });

// Middleware pour mettre à jour la note moyenne du pressing
avisSchema.post('save', async function(doc) {
  const Avis = this.constructor;
  
  // Ne calculer que pour les avis approuvés
  if (doc.statut === 'approuve') {
    const stats = await Avis.aggregate([
      {
        $match: {
          pressing: doc.pressing,
          statut: 'approuve',
        },
      },
      {
        $group: {
          _id: '$pressing',
          moyenne: { $avg: '$note' },
          nombreAvis: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      const { moyenne, nombreAvis } = stats[0];
      await mongoose.model('Pressing').findByIdAndUpdate(doc.pressing, {
        noteMoyenne: parseFloat(moyenne.toFixed(1)),
        nombreAvis,
      });
    }
  }
});

const Avis = mongoose.model('Avis', avisSchema);

module.exports = Avis;
