const mongoose = require('mongoose');

// Modèle Client direct (sans discriminateur)
const clientDirectSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  telephone: String,
  password: String,
  role: { type: String, default: 'client' },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  addresses: [{
    type: String,
    label: String,
    street: String,
    city: String,
    postalCode: String,
    country: String,
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number]
    },
    isDefault: Boolean
  }],
  status: { type: String, default: 'active' },
  lastLogin: Date
}, {
  timestamps: true,
  collection: 'clients' // Forcer l'utilisation de la collection 'clients'
});

const ClientDirect = mongoose.model('ClientDirect', clientDirectSchema);

module.exports = ClientDirect;
