const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schéma pour les créneaux horaires
const timeSlotSchema = new Schema({
  // Référence au pressing
  pressing: {
    type: Schema.Types.ObjectId,
    ref: 'Pressing',
    required: [true, 'Le pressing est requis'],
    index: true
  },
  
  // Date du créneau
  date: {
    type: Date,
    required: [true, 'La date est requise'],
    index: true
  },
  
  // Heure de début (format HH:MM)
  startTime: {
    type: String,
    required: [true, 'L\'heure de début est requise'],
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    index: true
  },
  
  // Heure de fin (format HH:MM)
  endTime: {
    type: String,
    required: [true, 'L\'heure de fin est requise'],
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  
  // Capacité maximale du créneau
  maxCapacity: {
    type: Number,
    required: [true, 'La capacité maximale est requise'],
    min: [1, 'La capacité doit être d\'au moins 1'],
    default: 5
  },
  
  // Nombre de réservations actuelles
  currentBookings: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Liste des commandes/rendez-vous pour ce créneau
  appointments: [{
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'ClientDirect',
      required: true
    },
    status: {
      type: String,
      enum: ['confirmed', 'pending', 'cancelled', 'completed'],
      default: 'pending'
    },
    bookedAt: {
      type: Date,
      default: Date.now
    },
    specialRequests: String,
    estimatedDuration: {
      type: Number, // en minutes
      default: 60
    }
  }],
  
  // Statut du créneau
  status: {
    type: String,
    enum: ['available', 'full', 'blocked', 'closed'],
    default: 'available',
    index: true
  },
  
  // Prix spécial pour ce créneau (optionnel)
  specialPrice: {
    type: Number,
    min: 0
  },
  
  // Remise appliquée (en pourcentage)
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Type de créneau
  slotType: {
    type: String,
    enum: ['regular', 'express', 'premium', 'bulk'],
    default: 'regular'
  },
  
  // Services disponibles pour ce créneau
  availableServices: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  
  // Notes internes du pressing
  internalNotes: {
    type: String,
    maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
  },
  
  // Métadonnées pour la récurrence
  recurrence: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: null
    },
    endDate: Date,
    parentSlot: {
      type: Schema.Types.ObjectId,
      ref: 'TimeSlot'
    }
  },
  
  // Informations de création/modification
  createdBy: {
    type: Schema.Types.ObjectId,
    refPath: 'createdByModel'
  },
  createdByModel: {
    type: String,
    enum: ['Pressing', 'Admin'],
    default: 'Pressing'
  },
  
  // Historique des modifications
  history: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'booking_added', 'booking_cancelled', 'blocked', 'unblocked'],
      required: true
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      refPath: 'history.performedByModel'
    },
    performedByModel: {
      type: String,
      enum: ['ClientDirect', 'Pressing', 'Admin']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index composé pour optimiser les requêtes
timeSlotSchema.index({ pressing: 1, date: 1, startTime: 1 }, { unique: true });
timeSlotSchema.index({ pressing: 1, date: 1, status: 1 });
timeSlotSchema.index({ date: 1, status: 1 });

// Virtuals
timeSlotSchema.virtual('isAvailable').get(function() {
  return this.status === 'available' && this.currentBookings < this.maxCapacity;
});

timeSlotSchema.virtual('remainingCapacity').get(function() {
  return Math.max(0, this.maxCapacity - this.currentBookings);
});

timeSlotSchema.virtual('occupancyRate').get(function() {
  return this.maxCapacity > 0 ? (this.currentBookings / this.maxCapacity) * 100 : 0;
});

// Méthodes d'instance

// Vérifier si le créneau peut accepter une nouvelle réservation
timeSlotSchema.methods.canAcceptBooking = function(requiredCapacity = 1) {
  return this.status === 'available' && 
         (this.currentBookings + requiredCapacity) <= this.maxCapacity;
};

// Ajouter une réservation au créneau
timeSlotSchema.methods.addBooking = async function(appointmentData) {
  if (!this.canAcceptBooking()) {
    throw new Error('Ce créneau est complet ou indisponible');
  }
  
  // Ajouter la réservation
  this.appointments.push({
    ...appointmentData,
    bookedAt: new Date()
  });
  
  // Mettre à jour le compteur
  this.currentBookings += 1;
  
  // Mettre à jour le statut si nécessaire
  if (this.currentBookings >= this.maxCapacity) {
    this.status = 'full';
  }
  
  // Ajouter à l'historique
  this.history.push({
    action: 'booking_added',
    performedBy: appointmentData.customer,
    performedByModel: 'ClientDirect',
    details: `Réservation ajoutée pour la commande ${appointmentData.order}`
  });
  
  return this.save();
};

// Annuler une réservation
timeSlotSchema.methods.cancelBooking = async function(orderId, cancelledBy, cancelledByModel) {
  const appointmentIndex = this.appointments.findIndex(
    apt => apt.order.toString() === orderId.toString()
  );
  
  if (appointmentIndex === -1) {
    throw new Error('Réservation non trouvée dans ce créneau');
  }
  
  // Marquer comme annulée
  this.appointments[appointmentIndex].status = 'cancelled';
  
  // Mettre à jour le compteur
  this.currentBookings = Math.max(0, this.currentBookings - 1);
  
  // Mettre à jour le statut
  if (this.status === 'full' && this.currentBookings < this.maxCapacity) {
    this.status = 'available';
  }
  
  // Ajouter à l'historique
  this.history.push({
    action: 'booking_cancelled',
    performedBy: cancelledBy,
    performedByModel: cancelledByModel,
    details: `Réservation annulée pour la commande ${orderId}`
  });
  
  return this.save();
};

// Bloquer/débloquer le créneau
timeSlotSchema.methods.toggleBlock = async function(blocked, performedBy, performedByModel, reason) {
  const newStatus = blocked ? 'blocked' : 'available';
  const oldStatus = this.status;
  
  this.status = newStatus;
  
  // Ajouter à l'historique
  this.history.push({
    action: blocked ? 'blocked' : 'unblocked',
    performedBy: performedBy,
    performedByModel: performedByModel,
    details: reason || `Créneau ${blocked ? 'bloqué' : 'débloqué'}`
  });
  
  return this.save();
};

// Méthodes statiques

// Trouver les créneaux disponibles pour un pressing à une date donnée
timeSlotSchema.statics.findAvailableSlots = function(pressingId, date, options = {}) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const query = {
    pressing: pressingId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: 'available',
    currentBookings: { $lt: this.maxCapacity }
  };
  
  // Filtres optionnels
  if (options.slotType) {
    query.slotType = options.slotType;
  }
  
  if (options.minCapacity) {
    query.$expr = {
      $gte: [{ $subtract: ['$maxCapacity', '$currentBookings'] }, options.minCapacity]
    };
  }
  
  return this.find(query)
    .populate('pressing', 'nomCommerce businessHours')
    .populate('availableServices', 'name price category')
    .sort({ startTime: 1 });
};

// Créer des créneaux récurrents
timeSlotSchema.statics.createRecurringSlots = async function(templateSlot, options = {}) {
  const { frequency, endDate, pressingId } = options;
  const slots = [];
  
  let currentDate = new Date(templateSlot.date);
  const finalDate = new Date(endDate);
  
  while (currentDate <= finalDate) {
    const slotData = {
      ...templateSlot,
      date: new Date(currentDate),
      pressing: pressingId,
      recurrence: {
        isRecurring: true,
        frequency: frequency,
        endDate: finalDate,
        parentSlot: templateSlot._id
      }
    };
    
    slots.push(slotData);
    
    // Incrémenter la date selon la fréquence
    switch (frequency) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }
  
  return this.insertMany(slots);
};

// Obtenir les statistiques des créneaux
timeSlotSchema.statics.getSlotStats = async function(pressingId, startDate, endDate) {
  const matchStage = {
    pressing: new mongoose.Types.ObjectId(pressingId)
  };
  
  if (startDate && endDate) {
    matchStage.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSlots: { $sum: 1 },
        availableSlots: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
        },
        fullSlots: {
          $sum: { $cond: [{ $eq: ['$status', 'full'] }, 1, 0] }
        },
        blockedSlots: {
          $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] }
        },
        totalCapacity: { $sum: '$maxCapacity' },
        totalBookings: { $sum: '$currentBookings' },
        averageOccupancy: {
          $avg: {
            $cond: [
              { $gt: ['$maxCapacity', 0] },
              { $multiply: [{ $divide: ['$currentBookings', '$maxCapacity'] }, 100] },
              0
            ]
          }
        }
      }
    }
  ]);
};

// Middleware pre-save pour validation
timeSlotSchema.pre('save', function(next) {
  // Vérifier que l'heure de fin est après l'heure de début
  const startTime = this.startTime.split(':').map(Number);
  const endTime = this.endTime.split(':').map(Number);
  
  const startMinutes = startTime[0] * 60 + startTime[1];
  const endMinutes = endTime[0] * 60 + endTime[1];
  
  if (endMinutes <= startMinutes) {
    return next(new Error('L\'heure de fin doit être après l\'heure de début'));
  }
  
  // Vérifier que currentBookings ne dépasse pas maxCapacity
  if (this.currentBookings > this.maxCapacity) {
    return next(new Error('Le nombre de réservations ne peut pas dépasser la capacité maximale'));
  }
  
  next();
});

// Export du modèle
const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);

module.exports = TimeSlot;
