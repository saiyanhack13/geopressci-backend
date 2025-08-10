const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    // Référence au pressing évalué
    pressing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pressing',
      required: [true, 'Le pressing est requis']
    },
    
    // Référence au client qui a laissé l'avis
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Le client est requis'],
      index: true
    },
    
    // Référence à la commande concernée (optionnelle)
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    
    // Note (de 1 à 5 étoiles)
    rating: {
      type: Number,
      required: [true, 'La note est requise'],
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'La note doit être un nombre entier entre 1 et 5'
      }
    },
    
    // Commentaire (optionnel)
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Le commentaire ne peut pas dépasser 1000 caractères']
    },
    
    // Photos (optionnelles)
    photos: [{
      url: {
        type: String,
        required: [true, 'L\'URL de la photo est requise']
      },
      caption: {
        type: String,
        trim: true,
        maxlength: [200, 'La légende ne peut pas dépasser 200 caractères']
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Réponse du pressing (optionnelle)
    ownerReply: {
      text: {
        type: String,
        trim: true,
        maxlength: [1000, 'La réponse ne peut pas dépasser 1000 caractères']
      },
      repliedAt: {
        type: Date
      }
    },
    
    // Métadonnées
    wasEdited: {
      type: Boolean,
      default: false
    },
    
    // Statut de modération
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    
    // Raison du rejet (si applicable)
    rejectionReason: {
      type: String,
      trim: true
    },
    
    // Données supplémentaires
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index pour les requêtes courantes
// Index composé pour les requêtes par pressing et status
reviewSchema.index({ pressing: 1, status: 1 });
// Index unique pour s'assurer qu'un client ne peut noter un pressing qu'une seule fois
reviewSchema.index({ client: 1, pressing: 1 }, { unique: true });
// Index pour le tri par note
reviewSchema.index({ rating: 1 });
// Index pour le tri par date de création (du plus récent au plus ancien)
reviewSchema.index({ createdAt: -1 });

// Middleware pour mettre à jour la note moyenne du pressing après chaque avis
reviewSchema.post('save', async function(doc) {
  if (doc.status === 'approved') {
    const Pressing = mongoose.model('Pressing');
    const pressing = await Pressing.findById(doc.pressing);
    
    if (pressing) {
      await pressing.updateRating();
    }
  }
});

// Méthode statique pour calculer les statistiques d'avis
reviewSchema.statics.getStats = async function(pressingId) {
  return this.aggregate([
    {
      $match: {
        pressing: mongoose.Types.ObjectId(pressingId),
        status: 'approved'
      }
    },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 },
        distribution: {
          $push: {
            rating: "$rating",
            count: { $sum: 1 }
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        average: { $round: [{ $ifNull: ["$average", 0] }, 1] },
        count: 1,
        distribution: {
          $arrayToObject: {
            $map: {
              input: [5, 4, 3, 2, 1],
              as: "r",
              in: {
                k: { $toString: "$$r" },
                v: {
                  $ifNull: [
                    {
                      $let: {
                        vars: {
                          match: {
                            $filter: {
                              input: "$distribution",
                              as: "d",
                              cond: { $eq: ["$$d.rating", "$$r"] }
                            }
                          }
                        },
                        in: { $arrayElemAt: ["$$match.count", 0] }
                      }
                    },
                    0
                  ]
                }
              }
            }
          }
        }
      }
    }
  ]);
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
