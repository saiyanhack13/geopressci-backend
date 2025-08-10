const TimeSlot = require('../models/timeSlot.model');
const Pressing = require('../models/pressing.model');
const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

/**
 * @desc    Créer des créneaux horaires pour un pressing
 * @route   POST /api/v1/pressings/:pressingId/time-slots
 * @access  Privé (Pressing, Admin)
 */
const createTimeSlots = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Données invalides', errors.array());
    }

    const { pressingId } = req.params;
    const { 
      date, 
      startTime, 
      endTime, 
      maxCapacity, 
      slotType, 
      specialPrice, 
      discount,
      availableServices,
      recurrence 
    } = req.body;

    // Vérifier que le pressing existe et appartient à l'utilisateur
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Pressing non trouvé');
    }

    // Vérifier les permissions
    if (req.user.role === 'pressing' && pressing._id.toString() !== req.user._id.toString()) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
    }

    // Vérifier que le créneau n'existe pas déjà
    const existingSlot = await TimeSlot.findOne({
      pressing: pressingId,
      date: new Date(date),
      startTime: startTime
    });

    if (existingSlot) {
      throw new ApiError(httpStatus.CONFLICT, 'Un créneau existe déjà à cette heure');
    }

    // Créer le créneau
    const slotData = {
      pressing: pressingId,
      date: new Date(date),
      startTime,
      endTime,
      maxCapacity: maxCapacity || 5,
      slotType: slotType || 'regular',
      specialPrice,
      discount: discount || 0,
      availableServices: availableServices || [],
      createdBy: req.user._id,
      createdByModel: req.user.role === 'pressing' ? 'Pressing' : 'Admin'
    };

    const timeSlot = await TimeSlot.create(slotData);

    // Si récurrence demandée, créer les créneaux récurrents
    if (recurrence && recurrence.isRecurring) {
      await TimeSlot.createRecurringSlots(slotData, {
        frequency: recurrence.frequency,
        endDate: recurrence.endDate,
        pressingId: pressingId
      });
    }

    // Populer les données pour la réponse
    await timeSlot.populate([
      { path: 'pressing', select: 'nomCommerce businessHours' },
      { path: 'availableServices', select: 'name price category' }
    ]);

    res.status(httpStatus.CREATED).json({
      success: true,
      message: 'Créneau créé avec succès',
      data: timeSlot
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Récupérer les créneaux disponibles d'un pressing
 * @route   GET /api/v1/pressings/:pressingId/available-slots
 * @access  Public
 */
const getAvailableSlots = async (req, res, next) => {
  try {
    const { pressingId } = req.params;
    const { 
      date, 
      startDate, 
      endDate, 
      slotType, 
      minCapacity,
      includeUnavailable = false 
    } = req.query;

    // Vérifier que le pressing existe
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Pressing non trouvé');
    }

    let slots = [];

    if (date) {
      // Récupérer les créneaux pour une date spécifique
      slots = await TimeSlot.findAvailableSlots(pressingId, date, {
        slotType,
        minCapacity: minCapacity ? parseInt(minCapacity) : undefined
      });
    } else if (startDate && endDate) {
      // Récupérer les créneaux pour une période
      const query = {
        pressing: pressingId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (!includeUnavailable) {
        query.status = 'available';
        query.$expr = { $lt: ['$currentBookings', '$maxCapacity'] };
      }

      if (slotType) {
        query.slotType = slotType;
      }

      slots = await TimeSlot.find(query)
        .populate('pressing', 'nomCommerce businessHours')
        .populate('availableServices', 'name price category')
        .sort({ date: 1, startTime: 1 });
    } else {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Date ou période requise');
    }

    // Grouper par date pour faciliter l'affichage
    const groupedSlots = slots.reduce((acc, slot) => {
      const dateKey = slot.date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(slot);
      return acc;
    }, {});

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Créneaux récupérés avec succès',
      data: {
        pressing: {
          id: pressing._id,
          name: pressing.nomCommerce,
          businessHours: pressing.businessHours
        },
        slots: groupedSlots,
        totalSlots: slots.length,
        availableSlots: slots.filter(slot => slot.isAvailable).length
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mettre à jour un créneau horaire
 * @route   PUT /api/v1/time-slots/:slotId
 * @access  Privé (Pressing, Admin)
 */
const updateTimeSlot = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Données invalides', errors.array());
    }

    const { slotId } = req.params;
    const updateData = req.body;

    const timeSlot = await TimeSlot.findById(slotId);
    if (!timeSlot) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Créneau non trouvé');
    }

    // Vérifier les permissions
    if (req.user.role === 'pressing') {
      const pressing = await Pressing.findById(timeSlot.pressing);
      if (pressing._id.toString() !== req.user._id.toString()) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
      }
    }

    // Ne pas permettre la modification si des réservations existent
    if (timeSlot.currentBookings > 0 && 
        (updateData.date || updateData.startTime || updateData.endTime)) {
      throw new ApiError(
        httpStatus.CONFLICT, 
        'Impossible de modifier la date/heure d\'un créneau avec des réservations'
      );
    }

    // Mettre à jour le créneau
    Object.assign(timeSlot, updateData);
    
    // Ajouter à l'historique
    timeSlot.history.push({
      action: 'updated',
      performedBy: req.user._id,
      performedByModel: req.user.role === 'pressing' ? 'Pressing' : 'Admin',
      details: 'Créneau mis à jour'
    });

    await timeSlot.save();

    await timeSlot.populate([
      { path: 'pressing', select: 'nomCommerce businessHours' },
      { path: 'availableServices', select: 'name price category' }
    ]);

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Créneau mis à jour avec succès',
      data: timeSlot
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bloquer/débloquer un créneau
 * @route   PATCH /api/v1/time-slots/:slotId/toggle-block
 * @access  Privé (Pressing, Admin)
 */
const toggleBlockTimeSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;
    const { blocked, reason } = req.body;

    const timeSlot = await TimeSlot.findById(slotId);
    if (!timeSlot) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Créneau non trouvé');
    }

    // Vérifier les permissions
    if (req.user.role === 'pressing') {
      const pressing = await Pressing.findById(timeSlot.pressing);
      if (pressing._id.toString() !== req.user._id.toString()) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
      }
    }

    await timeSlot.toggleBlock(
      blocked, 
      req.user._id, 
      req.user.role === 'pressing' ? 'Pressing' : 'Admin',
      reason
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: `Créneau ${blocked ? 'bloqué' : 'débloqué'} avec succès`,
      data: timeSlot
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Supprimer un créneau
 * @route   DELETE /api/v1/time-slots/:slotId
 * @access  Privé (Pressing, Admin)
 */
const deleteTimeSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;

    const timeSlot = await TimeSlot.findById(slotId);
    if (!timeSlot) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Créneau non trouvé');
    }

    // Vérifier les permissions
    if (req.user.role === 'pressing') {
      const pressing = await Pressing.findById(timeSlot.pressing);
      if (pressing._id.toString() !== req.user._id.toString()) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
      }
    }

    // Ne pas permettre la suppression si des réservations existent
    if (timeSlot.currentBookings > 0) {
      throw new ApiError(
        httpStatus.CONFLICT, 
        'Impossible de supprimer un créneau avec des réservations actives'
      );
    }

    await TimeSlot.findByIdAndDelete(slotId);

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Créneau supprimé avec succès'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Obtenir les statistiques des créneaux
 * @route   GET /api/v1/pressings/:pressingId/slot-stats
 * @access  Privé (Pressing, Admin)
 */
const getSlotStats = async (req, res, next) => {
  try {
    const { pressingId } = req.params;
    const { startDate, endDate } = req.query;

    // Vérifier que le pressing existe
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Pressing non trouvé');
    }

    // Vérifier les permissions
    if (req.user.role === 'pressing' && pressing._id.toString() !== req.user._id.toString()) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
    }

    const stats = await TimeSlot.getSlotStats(pressingId, startDate, endDate);

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: stats[0] || {
        totalSlots: 0,
        availableSlots: 0,
        fullSlots: 0,
        blockedSlots: 0,
        totalCapacity: 0,
        totalBookings: 0,
        averageOccupancy: 0
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Créer des créneaux en lot (template)
 * @route   POST /api/v1/pressings/:pressingId/bulk-time-slots
 * @access  Privé (Pressing, Admin)
 */
const createBulkTimeSlots = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Données invalides', errors.array());
    }

    const { pressingId } = req.params;
    const { 
      startDate, 
      endDate, 
      timeSlots, // Array of {startTime, endTime, maxCapacity, slotType}
      daysOfWeek, // Array of day numbers (0=Sunday, 1=Monday, etc.)
      skipExistingSlots = true 
    } = req.body;

    // Vérifier que le pressing existe et appartient à l'utilisateur
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Pressing non trouvé');
    }

    if (req.user.role === 'pressing' && pressing._id.toString() !== req.user._id.toString()) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
    }

    const slotsToCreate = [];
    const currentDate = new Date(startDate);
    const finalDate = new Date(endDate);

    while (currentDate <= finalDate) {
      // Vérifier si ce jour de la semaine est inclus
      if (!daysOfWeek || daysOfWeek.includes(currentDate.getDay())) {
        
        for (const timeSlotTemplate of timeSlots) {
          // Vérifier si le créneau existe déjà
          if (skipExistingSlots) {
            const existingSlot = await TimeSlot.findOne({
              pressing: pressingId,
              date: new Date(currentDate),
              startTime: timeSlotTemplate.startTime
            });
            
            if (existingSlot) {
              continue; // Passer au créneau suivant
            }
          }

          slotsToCreate.push({
            pressing: pressingId,
            date: new Date(currentDate),
            startTime: timeSlotTemplate.startTime,
            endTime: timeSlotTemplate.endTime,
            maxCapacity: timeSlotTemplate.maxCapacity || 5,
            slotType: timeSlotTemplate.slotType || 'regular',
            specialPrice: timeSlotTemplate.specialPrice,
            discount: timeSlotTemplate.discount || 0,
            availableServices: timeSlotTemplate.availableServices || [],
            createdBy: req.user._id,
            createdByModel: req.user.role === 'pressing' ? 'Pressing' : 'Admin'
          });
        }
      }
      
      // Passer au jour suivant
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Créer tous les créneaux en une fois
    const createdSlots = await TimeSlot.insertMany(slotsToCreate);

    res.status(httpStatus.CREATED).json({
      success: true,
      message: `${createdSlots.length} créneaux créés avec succès`,
      data: {
        createdCount: createdSlots.length,
        period: {
          startDate,
          endDate
        },
        slots: createdSlots
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTimeSlots,
  getAvailableSlots,
  updateTimeSlot,
  toggleBlockTimeSlot,
  deleteTimeSlot,
  getSlotStats,
  createBulkTimeSlots
};
