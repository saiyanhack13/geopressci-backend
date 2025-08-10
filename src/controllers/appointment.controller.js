const Appointment = require('../models/appointment.model');
const TimeSlot = require('../models/timeSlot.model');
const Pressing = require('../models/pressing.model');
const Order = require('../models/order.model');
const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');
const notificationService = require('../services/notification.service');

/**
 * @desc    Créer un nouveau rendez-vous
 * @route   POST /api/v1/appointments
 * @access  Privé (Client)
 */
const createAppointment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Données invalides', errors.array());
    }

    const {
      pressingId,
      timeSlotId,
      appointmentType,
      plannedServices,
      specialRequests,
      contactInfo,
      address
    } = req.body;

    // Vérifier que le pressing existe
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Pressing non trouvé');
    }

    // Vérifier que le créneau existe et est disponible
    const timeSlot = await TimeSlot.findById(timeSlotId);
    if (!timeSlot) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Créneau horaire non trouvé');
    }

    if (!timeSlot.canAcceptBooking()) {
      throw new ApiError(httpStatus.CONFLICT, 'Ce créneau n\'est plus disponible');
    }

    // Vérifier que le client n'a pas déjà un RDV à cette heure
    const existingAppointment = await Appointment.findOne({
      customer: req.user._id,
      timeSlot: timeSlotId,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingAppointment) {
      throw new ApiError(httpStatus.CONFLICT, 'Vous avez déjà un rendez-vous à cette heure');
    }

    // Créer le rendez-vous
    const appointmentData = {
      customer: req.user._id,
      pressing: pressingId,
      timeSlot: timeSlotId,
      appointmentDate: timeSlot.date,
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
      appointmentType: appointmentType || 'pickup',
      plannedServices: plannedServices || [],
      specialRequests,
      contactInfo: {
        phone: contactInfo?.phone || req.user.telephone,
        email: contactInfo?.email || req.user.email,
        preferredContactMethod: contactInfo?.preferredContactMethod || 'phone'
      },
      address: address || req.user.adresse
    };

    const appointment = await Appointment.create(appointmentData);

    // Réserver le créneau
    await timeSlot.addBooking({
      order: null, // Sera ajouté plus tard si une commande est créée
      customer: req.user._id,
      status: 'pending'
    });

    // Calculer l'estimation des coûts
    await appointment.calculateCostEstimate();

    // Populer les données pour la réponse
    await appointment.populate([
      { path: 'customer', select: 'prenom nom email telephone' },
      { path: 'pressing', select: 'nomCommerce adresse telephone businessHours' },
      { path: 'timeSlot', select: 'startTime endTime maxCapacity currentBookings' },
      { path: 'plannedServices.service', select: 'name price category duration' }
    ]);

    // Envoyer les notifications
    try {
      // Notification au pressing
      await notificationService.sendNotification(pressing._id, 'Pressing', {
        title: '🆕 Nouveau rendez-vous',
        message: `${req.user.prenom} ${req.user.nom} a pris un rendez-vous le ${appointment.appointmentDate.toLocaleDateString('fr-FR')} à ${appointment.startTime}`,
        type: 'appointment',
        data: { appointmentId: appointment._id }
      });

      // Notification au client (confirmation)
      await notificationService.sendNotification(req.user._id, 'ClientDirect', {
        title: '✅ Rendez-vous confirmé',
        message: `Votre rendez-vous chez ${pressing.nomCommerce} est enregistré pour le ${appointment.appointmentDate.toLocaleDateString('fr-FR')} à ${appointment.startTime}`,
        type: 'appointment',
        data: { appointmentId: appointment._id }
      });
    } catch (notificationError) {
      console.error('Erreur envoi notifications:', notificationError);
      // Ne pas faire échouer la création du RDV pour une erreur de notification
    }

    res.status(httpStatus.CREATED).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      data: appointment
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Récupérer les rendez-vous d'un utilisateur
 * @route   GET /api/v1/appointments
 * @access  Privé (Client, Pressing)
 */
const getAppointments = async (req, res, next) => {
  try {
    const {
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'appointmentDate',
      sortOrder = 'asc'
    } = req.query;

    // Construire la requête selon le rôle
    let query = {};
    
    if (req.user.role === 'client') {
      query.customer = req.user._id;
    } else if (req.user.role === 'pressing') {
      query.pressing = req.user._id;
    } else {
      // Admin peut voir tous les RDV
    }

    // Filtres optionnels
    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.appointmentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.appointmentDate = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.appointmentDate = { $lte: new Date(endDate) };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate('customer', 'prenom nom email telephone')
        .populate('pressing', 'nomCommerce adresse telephone')
        .populate('timeSlot', 'startTime endTime maxCapacity currentBookings')
        .populate('plannedServices.service', 'name price category')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Appointment.countDocuments(query)
    ]);

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Rendez-vous récupérés avec succès',
      data: {
        appointments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Récupérer un rendez-vous par ID
 * @route   GET /api/v1/appointments/:appointmentId
 * @access  Privé (Client propriétaire, Pressing concerné, Admin)
 */
const getAppointmentById = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate('customer', 'prenom nom email telephone')
      .populate('pressing', 'nomCommerce adresse telephone businessHours')
      .populate('timeSlot', 'startTime endTime maxCapacity currentBookings status')
      .populate('plannedServices.service', 'name price category duration description')
      .populate('order', 'orderNumber status totalAmount');

    if (!appointment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Rendez-vous non trouvé');
    }

    // Vérifier les permissions
    const hasAccess = 
      req.user.role === 'admin' ||
      (req.user.role === 'client' && appointment.customer._id.toString() === req.user._id.toString()) ||
      (req.user.role === 'pressing' && appointment.pressing._id.toString() === req.user._id.toString());

    if (!hasAccess) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Rendez-vous récupéré avec succès',
      data: appointment
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirmer un rendez-vous
 * @route   PATCH /api/v1/appointments/:appointmentId/confirm
 * @access  Privé (Pressing concerné, Admin)
 */
const confirmAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { confirmationMethod, notes } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('customer', 'prenom nom email telephone')
      .populate('pressing', 'nomCommerce');

    if (!appointment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Rendez-vous non trouvé');
    }

    // Vérifier les permissions
    if (req.user.role === 'pressing' && appointment.pressing._id.toString() !== req.user._id.toString()) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
    }

    if (appointment.status !== 'pending') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Ce rendez-vous ne peut pas être confirmé');
    }

    // Confirmer le rendez-vous
    await appointment.confirm(
      req.user._id,
      req.user.role === 'pressing' ? 'Pressing' : 'Admin',
      confirmationMethod || 'app'
    );

    // Envoyer notification au client
    try {
      await notificationService.sendNotification(appointment.customer._id, 'ClientDirect', {
        title: '✅ Rendez-vous confirmé',
        message: `Votre rendez-vous chez ${appointment.pressing.nomCommerce} a été confirmé pour le ${appointment.appointmentDate.toLocaleDateString('fr-FR')} à ${appointment.startTime}`,
        type: 'appointment',
        data: { 
          appointmentId: appointment._id,
          confirmationCode: appointment.confirmation.confirmationCode
        }
      });
    } catch (notificationError) {
      console.error('Erreur envoi notification:', notificationError);
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Rendez-vous confirmé avec succès',
      data: appointment
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Annuler un rendez-vous
 * @route   PATCH /api/v1/appointments/:appointmentId/cancel
 * @access  Privé (Client propriétaire, Pressing concerné, Admin)
 */
const cancelAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { reason, refundRequested = false } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('customer', 'prenom nom')
      .populate('pressing', 'nomCommerce');

    if (!appointment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Rendez-vous non trouvé');
    }

    // Vérifier les permissions
    const hasAccess = 
      req.user.role === 'admin' ||
      (req.user.role === 'client' && appointment.customer._id.toString() === req.user._id.toString()) ||
      (req.user.role === 'pressing' && appointment.pressing._id.toString() === req.user._id.toString());

    if (!hasAccess) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
    }

    // Annuler le rendez-vous
    await appointment.cancel(
      req.user._id,
      req.user.role === 'client' ? 'ClientDirect' : (req.user.role === 'pressing' ? 'Pressing' : 'Admin'),
      reason,
      refundRequested
    );

    // Envoyer notifications
    try {
      const cancelledBy = req.user.role === 'client' ? 'le client' : 'le pressing';
      
      // Notification au pressing (si annulé par le client)
      if (req.user.role === 'client') {
        await notificationService.sendNotification(appointment.pressing._id, 'Pressing', {
          title: '❌ Rendez-vous annulé',
          message: `Le rendez-vous du ${appointment.appointmentDate.toLocaleDateString('fr-FR')} à ${appointment.startTime} avec ${appointment.customer.prenom} ${appointment.customer.nom} a été annulé`,
          type: 'appointment',
          data: { appointmentId: appointment._id, reason }
        });
      }

      // Notification au client (si annulé par le pressing)
      if (req.user.role === 'pressing') {
        await notificationService.sendNotification(appointment.customer._id, 'ClientDirect', {
          title: '❌ Rendez-vous annulé',
          message: `Votre rendez-vous chez ${appointment.pressing.nomCommerce} du ${appointment.appointmentDate.toLocaleDateString('fr-FR')} à ${appointment.startTime} a été annulé`,
          type: 'appointment',
          data: { appointmentId: appointment._id, reason }
        });
      }
    } catch (notificationError) {
      console.error('Erreur envoi notifications:', notificationError);
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Rendez-vous annulé avec succès',
      data: appointment
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reporter un rendez-vous
 * @route   PATCH /api/v1/appointments/:appointmentId/reschedule
 * @access  Privé (Client propriétaire, Pressing concerné)
 */
const rescheduleAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { newTimeSlotId, reason } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('customer', 'prenom nom')
      .populate('pressing', 'nomCommerce');

    if (!appointment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Rendez-vous non trouvé');
    }

    // Vérifier les permissions
    const hasAccess = 
      (req.user.role === 'client' && appointment.customer._id.toString() === req.user._id.toString()) ||
      (req.user.role === 'pressing' && appointment.pressing._id.toString() === req.user._id.toString());

    if (!hasAccess) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
    }

    // Vérifier le nouveau créneau
    const newTimeSlot = await TimeSlot.findById(newTimeSlotId);
    if (!newTimeSlot) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Nouveau créneau non trouvé');
    }

    if (!newTimeSlot.canAcceptBooking()) {
      throw new ApiError(httpStatus.CONFLICT, 'Le nouveau créneau n\'est pas disponible');
    }

    // Reporter le rendez-vous
    await appointment.reschedule(
      newTimeSlotId,
      newTimeSlot.date,
      newTimeSlot.startTime,
      newTimeSlot.endTime,
      req.user._id,
      req.user.role === 'client' ? 'ClientDirect' : 'Pressing',
      reason
    );

    // Envoyer notifications
    try {
      const rescheduledBy = req.user.role === 'client' ? 'le client' : 'le pressing';
      
      // Notification à l'autre partie
      const notificationTarget = req.user.role === 'client' ? 
        { id: appointment.pressing._id, model: 'Pressing' } :
        { id: appointment.customer._id, model: 'ClientDirect' };

      await notificationService.sendNotification(notificationTarget.id, notificationTarget.model, {
        title: '📅 Rendez-vous reporté',
        message: `Le rendez-vous a été reporté au ${newTimeSlot.date.toLocaleDateString('fr-FR')} à ${newTimeSlot.startTime}`,
        type: 'appointment',
        data: { appointmentId: appointment._id, reason }
      });
    } catch (notificationError) {
      console.error('Erreur envoi notifications:', notificationError);
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Rendez-vous reporté avec succès',
      data: appointment
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Marquer un rendez-vous comme terminé
 * @route   PATCH /api/v1/appointments/:appointmentId/complete
 * @access  Privé (Pressing concerné, Admin)
 */
const completeAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { notes, actualServices, createOrder = false } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('customer')
      .populate('pressing');

    if (!appointment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Rendez-vous non trouvé');
    }

    // Vérifier les permissions
    if (req.user.role === 'pressing' && appointment.pressing._id.toString() !== req.user._id.toString()) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Accès refusé');
    }

    if (!['confirmed', 'in_progress'].includes(appointment.status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Ce rendez-vous ne peut pas être marqué comme terminé');
    }

    // Marquer comme terminé
    await appointment.complete(
      req.user._id,
      req.user.role === 'pressing' ? 'Pressing' : 'Admin',
      notes
    );

    // Créer une commande si demandé
    let order = null;
    if (createOrder && actualServices && actualServices.length > 0) {
      const orderData = {
        customer: appointment.customer._id,
        pressing: appointment.pressing._id,
        items: actualServices.map(service => ({
          service: service.serviceId,
          quantity: service.quantity || 1,
          unitPrice: service.price,
          serviceDetails: {
            name: service.name,
            price: service.price,
            category: service.category
          }
        })),
        appointmentDate: appointment.appointmentDate,
        appointmentId: appointment._id,
        status: 'pending'
      };

      order = await Order.create(orderData);
      
      // Lier la commande au rendez-vous
      appointment.order = order._id;
      await appointment.save();
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Rendez-vous terminé avec succès',
      data: {
        appointment,
        order: order || null
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Obtenir les statistiques des rendez-vous
 * @route   GET /api/v1/appointments/stats
 * @access  Privé (Pressing, Admin)
 */
const getAppointmentStats = async (req, res, next) => {
  try {
    const { startDate, endDate, pressingId } = req.query;

    // Déterminer l'ID du pressing selon le rôle
    let targetPressingId = pressingId;
    if (req.user.role === 'pressing') {
      targetPressingId = req.user._id;
    }

    const stats = await Appointment.getAppointmentStats(targetPressingId, startDate, endDate);

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: stats[0] || {
        totalAppointments: 0,
        pendingAppointments: 0,
        confirmedAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        noShowAppointments: 0,
        averageEstimatedValue: 0,
        totalEstimatedRevenue: 0
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
  completeAppointment,
  getAppointmentStats
};
