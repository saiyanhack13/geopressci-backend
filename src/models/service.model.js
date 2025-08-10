const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, 'Le nom du service est requis'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  dureeMoyenne: {
    type: Number, // en minutes
    required: [true, 'La durée moyenne est requise'],
    min: [1, 'La durée doit être supérieure à 0'],
  },
  prix: {
    type: Number,
    required: [true, 'Le prix est requis'],
    min: [0, 'Le prix ne peut pas être négatif'],
  },
  categorie: {
    type: String,
    required: [true, 'La catégorie est requise'],
    enum: ['nettoyage', 'lavage', 'repassage', 'teinture', 'retouche', 'autre'],
  },
  disponible: {
    type: Boolean,
    default: true,
  },
  pressing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pressing',
    required: [true, 'Le pressing est requis'],
  },
  // Options personnalisables pour ce service
  options: [{
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    supplementPrix: {
      type: Number,
      default: 0,
    },
  }],
  // Images du service
  images: [{
    url: String,
    altText: String,
  }],
  // Durée de validité du service (en jours)
  validite: {
    type: Number,
    default: 30, // 30 jours par défaut
    min: [1, 'La validité doit être d\'au moins 1 jour'],
  },
  // Informations de création/mise à jour
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pressing',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pressing',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index pour les recherches par pressing et catégorie
serviceSchema.index({ pressing: 1, categorie: 1 });
serviceSchema.index({ nom: 'text', description: 'text' });

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
