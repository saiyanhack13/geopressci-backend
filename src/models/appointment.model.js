const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schéma pour les rendez-vous/réservations
const appointmentSchema = new Schema({
  // Numéro de rendez-vous unique
  appointmentNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Référence au client
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'ClientDirect',
    required: [true, 'Le client est requis'],
    index: true
  },
  
  // Référence au pressing
  pressing: {
    type: Schema.Types.ObjectId,
    ref: 'Pressing',
    required: [true, 'Le pressing est requis'],
    index: true
  },
  
  // Référence au créneau horaire
  timeSlot: {
    type: Schema.Types.ObjectId,
    ref: 'TimeSlot',
    required: [true, 'Le créneau horaire est requis'],
    index: true
  },
  
  // Référence à la commande (optionnel - peut être créée après)
  order: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    index: true
  },
  
  // Date et heure du rendez-vous
  appointmentDate: {
    type: Date,
    required: [true, 'La date du rendez-vous est requise'],
    index: true
  },
  
  // Heure de début (format HH:MM)
  startTime: {
    type: String,
    required: [true, 'L\'heure de début est requise'],
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  
  // Heure de fin estimée (format HH:MM)
  endTime: {
    type: String,
    required: [true, 'L\'heure de fin est requise'],
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  
  // Durée estimée en minutes
  estimatedDuration: {
    type: Number,
    required: [true, 'La durée estimée est requise'],
    min: [15, 'La durée minimale est de 15 minutes'],
    default: 60
  },
  
  // Type de rendez-vous
  appointmentType: {
    type: String,
    enum: ['pickup', 'delivery', 'both', 'consultation'],
    required: [true, 'Le type de rendez-vous est requis'],
    default: 'pickup'
  },
  
  // Services prévisionnels
  plannedServices: [{
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    estimatedPrice: {
      type: Number,
      min: 0
    },
    specialInstructions: String
  }],
  
  // Statut du rendez-vous
  status: {
    type: String,
    enum: [
      'pending',      // En attente de confirmation
      'confirmed',    // Confirmé par le pressing
      'in_progress',  // En cours
      'completed',    // Terminé
      'cancelled',    // Annulé
      'no_show',      // Client absent
      'rescheduled'   // Reporté
    ],
    default: 'pending',
    index: true
  },
  
  // Informations de contact
  contactInfo: {
    phone: {
      type: String,
      required: [true, 'Le numéro de téléphone est requis']
    },
    email: String,
    preferredContactMethod: {
      type: String,
      enum: ['phone', 'email', 'sms', 'whatsapp'],
      default: 'phone'
    }
  },
  
  // Adresse pour livraison/collecte
  address: {
    street: String,
    neighborhood: String,
    city: { type: String, default: 'Abidjan' },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        validate: {
          validator: function(v) {
            return v && v.length === 2 && 
                   v[0] >= -180 && v[0] <= 180 && 
                   v[1] >= -90 && v[1] <= 90;
          },
          message: 'Coordonnées invalides'
        }
      }
    },
    instructions: String // Instructions d'accès
  },
  
  // Demandes spéciales du client
  specialRequests: {
    type: String,
    maxlength: [1000, 'Les demandes spéciales ne peuvent pas dépasser 1000 caractères']
  },
  
  // Notes internes du pressing
  internalNotes: {
    type: String,
    maxlength: [1000, 'Les notes internes ne peuvent pas dépasser 1000 caractères']
  },
  
  // Estimation des coûts
  costEstimate: {
    subtotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'FCFA' }
  },
  
  // Informations de confirmation
  confirmation: {
    confirmedAt: Date,
    confirmedBy: {
      type: Schema.Types.ObjectId,
      refPath: 'confirmation.confirmedByModel'
    },
    confirmedByModel: {
      type: String,
      enum: ['Pressing', 'Admin']
    },
    confirmationMethod: {
      type: String,
      enum: ['phone', 'email', 'sms', 'app'],
      default: 'app'
    },
    confirmationCode: String
  },
  
  // Rappels automatiques
  reminders: [{
    type: {
      type: String,
      enum: ['24h', '2h', '30min'],
      required: true
    },
    sent: { type: Boolean, default: false },
    sentAt: Date,
    method: {
      type: String,
      enum: ['email', 'sms', 'push', 'whatsapp'],
      default: 'sms'
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending'
    }
  }],
  
  // Historique des modifications
  statusHistory: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: {
      type: Schema.Types.ObjectId,
      refPath: 'statusHistory.changedByModel'
    },
    changedByModel: {
      type: String,
      enum: ['ClientDirect', 'Pressing', 'Admin', 'System']
    },
    reason: String,
    notes: String
  }],
  
  // Évaluation du rendez-vous
  rating: {
    customerRating: {
      punctuality: { type: Number, min: 1, max: 5 },
      serviceQuality: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      overall: { type: Number, min: 1, max: 5 },
      comment: String,
      ratedAt: Date
    },
    pressingRating: {
      customerPunctuality: { type: Number, min: 1, max: 5 },
      preparedness: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      overall: { type: Number, min: 1, max: 5 },
      comment: String,
      ratedAt: Date
    }
  },
  
  // Métadonnées pour la récurrence
  recurrence: {
    isRecurring: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly'],
      default: null
    },
    endDate: Date,
    nextAppointment: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    parentAppointment: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment'
    }
  },
  
  // Informations de facturation
  billing: {
    invoiceGenerated: { type: Boolean, default: false },
    invoiceNumber: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded'],
      default: 'pending'
    },
    paymentMethod: String,
    paidAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour optimiser les requêtes
appointmentSchema.index({ customer: 1, appointmentDate: 1 });
appointmentSchema.index({ pressing: 1, appointmentDate: 1, status: 1 });
appointmentSchema.index({ appointmentDate: 1, status: 1 });
appointmentSchema.index({ timeSlot: 1 });

// Index géospatial pour les adresses
appointmentSchema.index({ 'address.coordinates': '2dsphere' });

// Virtuals
appointmentSchema.virtual('isUpcoming').get(function() {
  return this.appointmentDate > new Date() && 
         ['pending', 'confirmed'].includes(this.status);
});

appointmentSchema.virtual('isPast').get(function() {
  return this.appointmentDate < new Date();
});

appointmentSchema.virtual('canBeCancelled').get(function() {
  const now = new Date();
  const appointmentTime = new Date(this.appointmentDate);
  const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);
  
  return ['pending', 'confirmed'].includes(this.status) && 
         hoursUntilAppointment > 2; // Peut être annulé jusqu'à 2h avant
});

appointmentSchema.virtual('canBeRescheduled').get(function() {
  const now = new Date();
  const appointmentTime = new Date(this.appointmentDate);
  const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);
  
  return ['pending', 'confirmed'].includes(this.status) && 
         hoursUntilAppointment > 4; // Peut être reporté jusqu'à 4h avant
});

// Méthodes d'instance

// Générer un numéro de rendez-vous unique
appointmentSchema.methods.generateAppointmentNumber = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `RDV-${year}${month}${day}-${random}`;
};

// Confirmer le rendez-vous
appointmentSchema.methods.confirm = async function(confirmedBy, confirmedByModel, confirmationMethod = 'app') {
  this.status = 'confirmed';
  this.confirmation = {
    confirmedAt: new Date(),
    confirmedBy: confirmedBy,
    confirmedByModel: confirmedByModel,
    confirmationMethod: confirmationMethod,
    confirmationCode: Math.floor(100000 + Math.random() * 900000).toString()
  };
  
  // Ajouter à l'historique
  this.statusHistory.push({
    status: 'confirmed',
    changedBy: confirmedBy,
    changedByModel: confirmedByModel,
    reason: 'Rendez-vous confirmé',
    notes: `Confirmé via ${confirmationMethod}`
  });
  
  return this.save();
};

// Annuler le rendez-vous
appointmentSchema.methods.cancel = async function(cancelledBy, cancelledByModel, reason, refundRequested = false) {
  if (!this.canBeCancelled) {
    throw new Error('Ce rendez-vous ne peut plus être annulé');
  }
  
  const oldStatus = this.status;
  this.status = 'cancelled';
  
  // Ajouter à l'historique
  this.statusHistory.push({
    status: 'cancelled',
    changedBy: cancelledBy,
    changedByModel: cancelledByModel,
    reason: reason || 'Annulation demandée',
    notes: refundRequested ? 'Remboursement demandé' : null
  });
  
  // Libérer le créneau horaire
  const TimeSlot = mongoose.model('TimeSlot');
  if (this.timeSlot) {
    await TimeSlot.findByIdAndUpdate(this.timeSlot, {
      $inc: { currentBookings: -1 },
      $set: { status: 'available' }
    });
  }
  
  return this.save();
};

// Reporter le rendez-vous
appointmentSchema.methods.reschedule = async function(newTimeSlotId, newDate, newStartTime, newEndTime, rescheduledBy, rescheduledByModel, reason) {
  if (!this.canBeRescheduled) {
    throw new Error('Ce rendez-vous ne peut plus être reporté');
  }
  
  // Libérer l'ancien créneau
  const TimeSlot = mongoose.model('TimeSlot');
  if (this.timeSlot) {
    await TimeSlot.findByIdAndUpdate(this.timeSlot, {
      $inc: { currentBookings: -1 },
      $set: { status: 'available' }
    });
  }
  
  // Réserver le nouveau créneau
  const newTimeSlot = await TimeSlot.findById(newTimeSlotId);
  if (!newTimeSlot || !newTimeSlot.canAcceptBooking()) {
    throw new Error('Le nouveau créneau n\'est pas disponible');
  }
  
  // Mettre à jour les informations
  this.timeSlot = newTimeSlotId;
  this.appointmentDate = new Date(newDate);
  this.startTime = newStartTime;
  this.endTime = newEndTime;
  this.status = 'rescheduled';
  
  // Ajouter à l'historique
  this.statusHistory.push({
    status: 'rescheduled',
    changedBy: rescheduledBy,
    changedByModel: rescheduledByModel,
    reason: reason || 'Rendez-vous reporté',
    notes: `Nouveau créneau: ${newDate} à ${newStartTime}`
  });
  
  // Réserver le nouveau créneau
  await newTimeSlot.addBooking({
    order: this.order,
    customer: this.customer,
    status: 'confirmed'
  });
  
  return this.save();
};

// Marquer comme terminé
appointmentSchema.methods.complete = async function(completedBy, completedByModel, notes) {
  this.status = 'completed';
  
  // Ajouter à l'historique
  this.statusHistory.push({
    status: 'completed',
    changedBy: completedBy,
    changedByModel: completedByModel,
    reason: 'Rendez-vous terminé',
    notes: notes
  });
  
  return this.save();
};

// Calculer l'estimation des coûts
appointmentSchema.methods.calculateCostEstimate = async function() {
  let subtotal = 0;
  
  // Calculer le coût des services
  for (const plannedService of this.plannedServices) {
    if (plannedService.estimatedPrice) {
      subtotal += plannedService.estimatedPrice * plannedService.quantity;
    }
  }
  
  // Récupérer les frais de livraison du pressing
  const pressing = await mongoose.model('Pressing').findById(this.pressing);
  let deliveryFee = 0;
  
  if (this.appointmentType === 'delivery' || this.appointmentType === 'both') {
    deliveryFee = pressing?.deliveryOptions?.deliveryFee || 0;
    
    // Livraison gratuite si seuil atteint
    if (pressing?.deliveryOptions?.freeDeliveryThreshold && 
        subtotal >= pressing.deliveryOptions.freeDeliveryThreshold) {
      deliveryFee = 0;
    }
  }
  
  // Calculer les taxes (TVA 18% en Côte d'Ivoire)
  const taxes = (subtotal + deliveryFee) * 0.18;
  const total = subtotal + deliveryFee + taxes;
  
  this.costEstimate = {
    subtotal,
    deliveryFee,
    taxes,
    total,
    currency: 'FCFA'
  };
  
  return this.save();
};

// Méthodes statiques

// Trouver les rendez-vous par statut
appointmentSchema.statics.findByStatus = function(status, options = {}) {
  const query = { status };
  
  if (options.pressingId) {
    query.pressing = options.pressingId;
  }
  
  if (options.customerId) {
    query.customer = options.customerId;
  }
  
  if (options.startDate && options.endDate) {
    query.appointmentDate = {
      $gte: new Date(options.startDate),
      $lte: new Date(options.endDate)
    };
  }
  
  return this.find(query)
    .populate('customer', 'prenom nom email telephone')
    .populate('pressing', 'nomCommerce adresse telephone')
    .populate('timeSlot', 'startTime endTime maxCapacity')
    .sort({ appointmentDate: 1 });
};

// Obtenir les statistiques des rendez-vous
appointmentSchema.statics.getAppointmentStats = async function(pressingId, startDate, endDate) {
  const matchStage = {};
  
  if (pressingId) {
    matchStage.pressing = new mongoose.Types.ObjectId(pressingId);
  }
  
  if (startDate && endDate) {
    matchStage.appointmentDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAppointments: { $sum: 1 },
        pendingAppointments: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        confirmedAppointments: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
        },
        completedAppointments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelledAppointments: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        noShowAppointments: {
          $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
        },
        averageEstimatedValue: { $avg: '$costEstimate.total' },
        totalEstimatedRevenue: { $sum: '$costEstimate.total' }
      }
    }
  ]);
};

// Middleware pre-save
appointmentSchema.pre('save', function(next) {
  // Générer un numéro de rendez-vous si nouveau
  if (this.isNew && !this.appointmentNumber) {
    this.appointmentNumber = this.generateAppointmentNumber();
  }
  
  // Ajouter l'entrée initiale dans l'historique si nouveau
  if (this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedBy: this.customer,
      changedByModel: 'ClientDirect',
      reason: 'Rendez-vous créé'
    });
  }
  
  next();
});

// Export du modèle
const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
