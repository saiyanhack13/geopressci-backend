const Pressing = require('../models/pressing.model');
const { ErrorResponse } = require('../utils/error.utils');

const DAYS_OF_WEEK = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/**
 * @desc    Récupérer les horaires du pressing connecté
 * @route   GET /api/v1/pressing/hours
 * @access  Privé (Pressing)
 */
const getMyHours = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const pressing = await Pressing.findById(pressingId).select('businessHours businessName');

    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Organiser les horaires par jour de la semaine
    const organizedHours = DAYS_OF_WEEK.map(day => {
      const dayHours = pressing.businessHours.find(hours => hours.day === day);
      return {
        day,
        open: dayHours?.open || '09:00',
        close: dayHours?.close || '18:00',
        isClosed: dayHours?.isClosed || false,
        specialHours: dayHours?.specialHours || null
      };
    });

    res.status(200).json({
      success: true,
      data: organizedHours
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mettre à jour les horaires d'un jour spécifique
 * @route   PUT /api/v1/pressing/hours/:day
 * @access  Privé (Pressing)
 */
const updateDayHours = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { day } = req.params;
    const { open, close, isClosed, specialHours } = req.body;

    // Validation du jour
    if (!DAYS_OF_WEEK.includes(day)) {
      return res.status(400).json({
        success: false,
        message: 'Jour invalide. Utilisez: ' + DAYS_OF_WEEK.join(', ')
      });
    }

    // Validation des horaires si le jour n'est pas fermé
    if (!isClosed) {
      if (!open || !close) {
        return res.status(400).json({
          success: false,
          message: 'Les heures d\'ouverture et de fermeture sont requises'
        });
      }

      // Validation du format des heures (HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(open) || !timeRegex.test(close)) {
        return res.status(400).json({
          success: false,
          message: 'Format d\'heure invalide. Utilisez le format HH:MM'
        });
      }

      // Vérifier que l'heure d'ouverture est avant l'heure de fermeture
      const [openHour, openMinute] = open.split(':').map(Number);
      const [closeHour, closeMinute] = close.split(':').map(Number);
      const openTime = openHour * 60 + openMinute;
      const closeTime = closeHour * 60 + closeMinute;

      if (openTime >= closeTime) {
        return res.status(400).json({
          success: false,
          message: 'L\'heure d\'ouverture doit être antérieure à l\'heure de fermeture'
        });
      }
    }

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Trouver l'index des horaires pour ce jour
    const dayIndex = pressing.businessHours.findIndex(hours => hours.day === day);

    const updatedHours = {
      day,
      open: isClosed ? null : open,
      close: isClosed ? null : close,
      isClosed: isClosed || false,
      specialHours: specialHours || null
    };

    if (dayIndex !== -1) {
      // Mettre à jour les horaires existants
      pressing.businessHours[dayIndex] = updatedHours;
    } else {
      // Ajouter de nouveaux horaires
      pressing.businessHours.push(updatedHours);
    }

    await pressing.save();

    res.status(200).json({
      success: true,
      message: `Horaires du ${day} mis à jour avec succès`,
      data: updatedHours
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map(val => val.message).join(', ');
      return res.status(400).json({
        success: false,
        message
      });
    }
    next(error);
  }
};

/**
 * @desc    Mettre à jour tous les horaires d'un coup
 * @route   PUT /api/v1/pressing/hours
 * @access  Privé (Pressing)
 */
const updateAllHours = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { hours } = req.body;

    if (!hours || !Array.isArray(hours)) {
      return res.status(400).json({
        success: false,
        message: 'Un tableau d\'horaires est requis'
      });
    }

    // Validation de chaque jour
    for (const dayHours of hours) {
      const { day, open, close, isClosed } = dayHours;

      if (!DAYS_OF_WEEK.includes(day)) {
        return res.status(400).json({
          success: false,
          message: `Jour invalide: ${day}. Utilisez: ${DAYS_OF_WEEK.join(', ')}`
        });
      }

      if (!isClosed) {
        if (!open || !close) {
          return res.status(400).json({
            success: false,
            message: `Les heures d'ouverture et de fermeture sont requises pour ${day}`
          });
        }

        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(open) || !timeRegex.test(close)) {
          return res.status(400).json({
            success: false,
            message: `Format d'heure invalide pour ${day}. Utilisez le format HH:MM`
          });
        }

        const [openHour, openMinute] = open.split(':').map(Number);
        const [closeHour, closeMinute] = close.split(':').map(Number);
        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;

        if (openTime >= closeTime) {
          return res.status(400).json({
            success: false,
            message: `L'heure d'ouverture doit être antérieure à l'heure de fermeture pour ${day}`
          });
        }
      }
    }

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Remplacer tous les horaires
    pressing.businessHours = hours.map(dayHours => ({
      day: dayHours.day,
      open: dayHours.isClosed ? null : dayHours.open,
      close: dayHours.isClosed ? null : dayHours.close,
      isClosed: dayHours.isClosed || false,
      specialHours: dayHours.specialHours || null
    }));

    await pressing.save();

    res.status(200).json({
      success: true,
      message: 'Tous les horaires ont été mis à jour avec succès',
      data: pressing.businessHours
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map(val => val.message).join(', ');
      return res.status(400).json({
        success: false,
        message
      });
    }
    next(error);
  }
};

/**
 * @desc    Copier les horaires d'un jour vers d'autres jours
 * @route   POST /api/v1/pressing/hours/copy
 * @access  Privé (Pressing)
 */
const copyHours = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { sourceDay, targetDays } = req.body;

    if (!DAYS_OF_WEEK.includes(sourceDay)) {
      return res.status(400).json({
        success: false,
        message: 'Jour source invalide'
      });
    }

    if (!targetDays || !Array.isArray(targetDays) || targetDays.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Au moins un jour cible est requis'
      });
    }

    // Validation des jours cibles
    for (const day of targetDays) {
      if (!DAYS_OF_WEEK.includes(day)) {
        return res.status(400).json({
          success: false,
          message: `Jour cible invalide: ${day}`
        });
      }
    }

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Trouver les horaires du jour source
    const sourceHours = pressing.businessHours.find(hours => hours.day === sourceDay);
    if (!sourceHours) {
      return res.status(404).json({
        success: false,
        message: `Aucun horaire trouvé pour ${sourceDay}`
      });
    }

    // Copier vers les jours cibles
    targetDays.forEach(targetDay => {
      const targetIndex = pressing.businessHours.findIndex(hours => hours.day === targetDay);
      
      const copiedHours = {
        day: targetDay,
        open: sourceHours.open,
        close: sourceHours.close,
        isClosed: sourceHours.isClosed,
        specialHours: sourceHours.specialHours
      };

      if (targetIndex !== -1) {
        pressing.businessHours[targetIndex] = copiedHours;
      } else {
        pressing.businessHours.push(copiedHours);
      }
    });

    await pressing.save();

    res.status(200).json({
      success: true,
      message: `Horaires copiés de ${sourceDay} vers ${targetDays.join(', ')}`,
      data: pressing.businessHours
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Vérifier si le pressing est ouvert maintenant
 * @route   GET /api/v1/pressing/hours/status
 * @access  Privé (Pressing)
 */
const getCurrentStatus = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const pressing = await Pressing.findById(pressingId).select('businessHours businessName');

    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    const now = new Date();
    const currentDay = DAYS_OF_WEEK[now.getDay() === 0 ? 6 : now.getDay() - 1]; // Ajuster pour commencer par lundi
    const currentTime = now.toTimeString().slice(0, 5); // Format HH:MM

    const todayHours = pressing.businessHours.find(hours => hours.day === currentDay);
    
    let isOpen = false;
    let nextOpenTime = null;
    let message = '';

    if (!todayHours || todayHours.isClosed) {
      message = `Fermé aujourd'hui (${currentDay})`;
      // Trouver le prochain jour d'ouverture
      for (let i = 1; i <= 7; i++) {
        const nextDayIndex = (DAYS_OF_WEEK.indexOf(currentDay) + i) % 7;
        const nextDay = DAYS_OF_WEEK[nextDayIndex];
        const nextDayHours = pressing.businessHours.find(hours => hours.day === nextDay);
        
        if (nextDayHours && !nextDayHours.isClosed) {
          nextOpenTime = `${nextDay} à ${nextDayHours.open}`;
          break;
        }
      }
    } else {
      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      const [openHour, openMinute] = todayHours.open.split(':').map(Number);
      const [closeHour, closeMinute] = todayHours.close.split(':').map(Number);
      
      const currentMinutes = currentHour * 60 + currentMinute;
      const openMinutes = openHour * 60 + openMinute;
      const closeMinutes = closeHour * 60 + closeMinute;
      
      if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
        isOpen = true;
        message = `Ouvert jusqu'à ${todayHours.close}`;
      } else if (currentMinutes < openMinutes) {
        message = `Fermé - Ouvre à ${todayHours.open}`;
        nextOpenTime = `aujourd'hui à ${todayHours.open}`;
      } else {
        message = `Fermé - Ouvre demain à ${todayHours.open}`;
        nextOpenTime = `demain à ${todayHours.open}`;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        isOpen,
        currentDay,
        currentTime,
        message,
        nextOpenTime,
        todayHours: todayHours || { day: currentDay, isClosed: true }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyHours,
  updateDayHours,
  updateAllHours,
  copyHours,
  getCurrentStatus
};
