const User = require('../models/user.model');
const Pressing = require('../models/pressing.model');
const Abonnement = require('../models/abonnement.model');
const Transaction = require('../models/transaction.model');
const Promotion = require('../models/promotion.model');
const AdminReport = require('../models/adminReport.model');
const { SUBSCRIPTION_STATUS } = require('../models/abonnement.model');
const { ROLES } = require('../config/roles');
const logger = require('../utils/logger');

/**
 * @swagger
 * tags:
 *   name: Admin - User Management
 *   description: Gestion des utilisateurs (clients et pressings) par l'administrateur
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Récupérer la liste des utilisateurs avec filtres
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [client, pressing, admin]
 *         description: Filtrer par rôle d'utilisateur
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         description: Filtrer par statut du compte
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par nom, email ou téléphone
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Nombre d'éléments par page
 *     responses:
 *       200:
 *         description: Liste des utilisateurs récupérée avec succès
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Droits insuffisants
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    if (role) {
      query.role = role;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get users with pagination
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    // Get subscription status for pressings
    const usersWithSubscription = await Promise.all(users.map(async user => {
      if (user.role === ROLES.PRESSING) {
        const subscription = await Abonnement.findOne({ user: user._id });
        return {
          ...user.toObject(),
          subscriptionStatus: subscription?.status || 'inactive'
        };
      }
      return user;
    }));
    
    res.json({
      success: true,
      count: users.length,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      },
      data: usersWithSubscription
    });
    
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`, { error });
    next(error);
  }
};

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'un utilisateur
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *                 description: Nouveau statut du compte
 *               reason:
 *                 type: string
 *                 description: Raison du changement de statut
 *     responses:
 *       200:
 *         description: Statut utilisateur mis à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Droits insuffisants
 *       404:
 *         description: Utilisateur non trouvé
 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    
    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Prevent modifying super admin
    if (user.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Action non autorisée sur un super administrateur'
      });
    }
    
    // Update user status
    user.status = status;
    user.statusHistory = user.statusHistory || [];
    user.statusHistory.push({
      status,
      changedBy: req.user._id,
      reason,
      date: new Date()
    });
    
    await user.save();
    
    // TODO: Send email notification to user about status change
    
    res.json({
      success: true,
      data: {
        userId: user._id,
        status: user.status,
        updatedAt: user.updatedAt
      }
    });
    
  } catch (error) {
    logger.error(`Error updating user status: ${error.message}`, { error });
    next(error);
  }
};

/**
 * @swagger
 * /admin/reports/generate:
 *   post:
 *     summary: Générer un nouveau rapport
 *     tags: [Admin - Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - period
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [user_registrations, revenue, subscriptions, custom]
 *                 description: Type de rapport
 *               title:
 *                 type: string
 *                 description: Titre du rapport
 *               description:
 *                 type: string
 *                 description: Description du rapport
 *               period:
 *                 type: object
 *                 required:
 *                   - start
 *                   - end
 *                 properties:
 *                   start:
 *                     type: string
 *                     format: date
 *                     description: Date de début (YYYY-MM-DD)
 *                   end:
 *                     type: string
 *                     format: date
 *                     description: Date de fin (YYYY-MM-DD)
 *               filters:
 *                 type: object
 *                 description: Filtres supplémentaires
 *               format:
 *                 type: string
 *                 enum: [json, csv, pdf, xlsx]
 *                 default: json
 *                 description: Format de sortie du rapport
 *     responses:
 *       202:
 *         description: Génération du rapport en cours
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Génération du rapport en cours"
 *                 reportId:
 *                   type: string
 *                   description: ID du rapport en cours de génération
 *       400:
 *         description: Données de requête invalides
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Droits insuffisants
 */
exports.generateReport = async (req, res, next) => {
  try {
    const { type, title, description, period, filters = {}, format = 'json' } = req.body;
    
    // Create report record
    const report = new AdminReport({
      type,
      title,
      description,
      period: {
        start: new Date(period.start),
        end: new Date(period.end)
      },
      filters,
      format,
      generatedBy: req.user._id,
      status: 'processing'
    });
    
    await report.save();
    
    // Process report in background
    processReportInBackground(report._id);
    
    res.status(202).json({
      success: true,
      message: 'Génération du rapport en cours',
      reportId: report._id
    });
    
  } catch (error) {
    logger.error(`Error generating report: ${error.message}`, { error });
    next(error);
  }
};

// Background job to process report
async function processReportInBackground(reportId) {
  try {
    const report = await AdminReport.findById(reportId);
    if (!report) return;
    
    let data;
    
    // Generate report based on type
    switch (report.type) {
      case 'user_registrations':
        data = await generateUserRegistrationsReport(report);
        break;
      case 'revenue':
        data = await generateRevenueReport(report);
        break;
      case 'subscriptions':
        data = await generateSubscriptionsReport(report);
        break;
      default:
        throw new Error('Type de rapport non supporté');
    }
    
    // Update report with data
    report.data = data;
    report.status = 'completed';
    report.completedAt = new Date();
    
    // TODO: Generate file if format is not JSON
    
    await report.save();
    
    // TODO: Send email notification with report link
    
  } catch (error) {
    logger.error(`Error processing report ${reportId}: ${error.message}`, { error });
    
    // Update report with error
    await AdminReport.findByIdAndUpdate(reportId, {
      status: 'failed',
      error: error.message,
      completedAt: new Date()
    });
  }
}

// Generate user registrations report
async function generateUserRegistrationsReport(report) {
  const { start, end } = report.period;
  const { role } = report.filters;
  
  const match = {
    createdAt: { $gte: start, $lte: end }
  };
  
  if (role) {
    match.role = role;
  }
  
  // Group by day and role
  const result = await User.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          role: '$role'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1, '_id.role': 1 } }
  ]);
  
  // Format data for charts
  const dates = [];
  const roles = [...new Set(result.map(r => r._id.role))];
  const series = roles.map(role => ({
    name: role,
    data: []
  }));
  
  // Process each day
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    dates.push(dateStr);
    
    // Initialize counts for each role
    const dayData = result.filter(r => r._id.date === dateStr);
    
    series.forEach(seriesItem => {
      const roleData = dayData.find(d => d._id.role === seriesItem.name);
      seriesItem.data.push(roleData ? roleData.count : 0);
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    type: 'user_registrations',
    period: report.period,
    total: result.reduce((sum, r) => sum + r.count, 0),
    dates,
    series,
    roles,
    rawData: result
  };
}

// Generate revenue report
async function generateRevenueReport(report) {
  const { start, end } = report.period;
  const { type } = report.filters;
  
  const match = {
    createdAt: { $gte: start, $lte: end },
    status: 'completed',
    type: { $in: ['subscription', 'service'] }
  };
  
  if (type) {
    match.type = type;
  }
  
  // Group by day and type
  const result = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          type: '$type'
        },
        amount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1, '_id.type': 1 } }
  ]);
  
  // Format data for charts
  const dates = [];
  const types = [...new Set(result.map(r => r._id.type))];
  const series = types.map(type => ({
    name: type,
    data: []
  }));
  
  // Process each day
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    dates.push(dateStr);
    
    // Initialize amounts for each type
    const dayData = result.filter(r => r._id.date === dateStr);
    
    series.forEach(seriesItem => {
      const typeData = dayData.find(d => d._id.type === seriesItem.name);
      seriesItem.data.push(typeData ? typeData.amount : 0);
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Calculate totals
  const totals = types.map(type => {
    const typeData = result.filter(r => r._id.type === type);
    return {
      type,
      totalAmount: typeData.reduce((sum, r) => sum + r.amount, 0),
      totalCount: typeData.reduce((sum, r) => sum + r.count, 0)
    };
  });
  
  return {
    type: 'revenue',
    period: report.period,
    totalAmount: totals.reduce((sum, t) => sum + t.totalAmount, 0),
    totalCount: totals.reduce((sum, t) => sum + t.totalCount, 0),
    dates,
    series,
    types,
    totals,
    rawData: result
  };
}

// Generate subscriptions report
async function generateSubscriptionsReport(report) {
  const { start, end } = report.period;
  const { status } = report.filters;
  
  const match = {
    startDate: { $lte: end },
    $or: [
      { endDate: { $gte: start } },
      { endDate: null }
    ]
  };
  
  if (status) {
    match.status = status;
  }
  
  // Get subscriptions with user details
  const subscriptions = await Abonnement.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        type: 1,
        status: 1,
        startDate: 1,
        endDate: 1,
        amount: 1,
        paymentMethod: 1,
        userId: '$user._id',
        userEmail: '$user.email',
        userFullName: '$user.fullName',
        userPhone: '$user.phone'
      }
    },
    { $sort: { startDate: -1 } }
  ]);
  
  // Calculate stats by status
  const statsByStatus = await Abonnement.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  // Calculate stats by type
  const statsByType = await Abonnement.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  return {
    type: 'subscriptions',
    period: report.period,
    total: subscriptions.length,
    statsByStatus,
    statsByType,
    subscriptions,
    rawData: subscriptions
  };
}

/**
 * @swagger
 * /admin/promotions:
 *   post:
 *     summary: Créer une nouvelle promotion
 *     tags: [Admin - Promotions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Promotion'
 *     responses:
 *       201:
 *         description: Promotion créée avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 */
exports.createPromotion = async (req, res, next) => {
  try {
    const promotionData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const promotion = new Promotion(promotionData);
    await promotion.save();
    
    res.status(201).json({
      success: true,
      data: promotion
    });
    
  } catch (error) {
    logger.error(`Error creating promotion: ${error.message}`, { error });
    next(error);
  }
};

/**
 * @swagger
 * /admin/promotions/{id}:
 *   put:
 *     summary: Mettre à jour une promotion
 *     tags: [Admin - Promotions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la promotion
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Promotion'
 *     responses:
 *       200:
 *         description: Promotion mise à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Promotion non trouvée
 */
exports.updatePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const promotion = await Promotion.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: promotion
    });
    
  } catch (error) {
    logger.error(`Error updating promotion: ${error.message}`, { error });
    next(error);
  }
};

/**
 * @swagger
 * /admin/promotions:
 *   get:
 *     summary: Récupérer la liste des promotions
 *     tags: [Admin - Promotions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, scheduled, expired, paused, deleted]
 *         description: Filtrer par statut
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [percentage, fixed_amount, free_trial, buy_x_get_y]
 *         description: Filtrer par type de promotion
 *     responses:
 *       200:
 *         description: Liste des promotions récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Promotion'
 *       401:
 *         description: Non autorisé
 */
exports.getPromotions = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (type) {
      query.type = type;
    }
    
    const promotions = await Promotion.find(query)
      .sort({ validFrom: -1 })
      .populate('createdBy', 'fullName email');
    
    res.json({
      success: true,
      count: promotions.length,
      data: promotions
    });
    
  } catch (error) {
    logger.error(`Error fetching promotions: ${error.message}`, { error });
    next(error);
  }
};

/**
 * @swagger
 * /admin/promotions/{id}:
 *   get:
 *     summary: Récupérer une promotion par son ID
 *     tags: [Admin - Promotions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la promotion
 *     responses:
 *       200:
 *         description: Promotion récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Promotion'
 *       404:
 *         description: Promotion non trouvée
 *       401:
 *         description: Non autorisé
 */
exports.getPromotionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const promotion = await Promotion.findById(id)
      .populate('createdBy', 'fullName email');
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: promotion
    });
    
  } catch (error) {
    logger.error(`Error fetching promotion: ${error.message}`, { error });
    next(error);
  }
};

/**
 * @swagger
 * /admin/promotions/{id}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'une promotion
 *     tags: [Admin - Promotions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la promotion
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, scheduled, expired, paused, deleted]
 *                 description: Nouveau statut de la promotion
 *     responses:
 *       200:
 *         description: Statut de la promotion mis à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Promotion non trouvée
 */
exports.updatePromotionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const promotion = await Promotion.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: promotion._id,
        status: promotion.status,
        updatedAt: promotion.updatedAt
      }
    });
    
  } catch (error) {
    logger.error(`Error updating promotion status: ${error.message}`, { error });
    next(error);
  }
};

/**
 * @swagger
 * /admin/promotions/{id}:
 *   delete:
 *     summary: Supprimer une promotion
 *     tags: [Admin - Promotions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la promotion à supprimer
 *     responses:
 *       200:
 *         description: Promotion supprimée avec succès
 *       404:
 *         description: Promotion non trouvée
 *       401:
 *         description: Non autorisé
 */
exports.deletePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const promotion = await Promotion.findByIdAndDelete(id);
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: promotion._id,
        message: 'Promotion supprimée avec succès'
      }
    });
    
  } catch (error) {
    logger.error(`Error deleting promotion: ${error.message}`, { error });
    next(error);
  }
};

// Helper function to check if user has required permissions
function hasPermission(user, requiredPermission) {
  if (!user || !user.role) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  
  const userPermissions = user.permissions || [];
  return userPermissions.includes(requiredPermission);
}

/**
 * @swagger
 * /admin/reports/{id}:
 *   get:
 *     summary: Récupérer un rapport généré
 *     tags: [Admin - Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du rapport à récupérer
 *     responses:
 *       200:
 *         description: Rapport récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AdminReport'
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Droits insuffisants
 *       404:
 *         description: Rapport non trouvé
 */
const getReport = async (req, res, next) => {
  try {
    const report = await AdminReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé'
      });
    }

    // Vérifier que l'utilisateur a le droit d'accéder à ce rapport
    if (report.generatedBy.toString() !== req.user.id && !req.user.roles.includes(ROLES.SUPER_ADMIN)) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à accéder à ce rapport'
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération du rapport: ${error.message}`, { error });
    next(error);
  }
};

// Helper function to validate report filters
function validateReportFilters(filters, reportType) {
  // Implementation...
  // Add validation logic based on report type
  // Return { valid: boolean, error?: string }
  return { valid: true };
}

/**
 * @swagger
 * /admin/reports/{id}:
 *   get:
 *     summary: Récupérer un rapport par son ID
 *     tags: [Admin - Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du rapport à récupérer
 *     responses:
 *       200:
 *         description: Détails du rapport
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminReport'
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Droits insuffisants
 *       404:
 *         description: Rapport non trouvé
 */
exports.getReport = async (req, res, next) => {
  try {
    const report = await AdminReport.findById(req.params.id)
      .populate('generatedBy', 'firstName lastName email')
      .lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé'
      });
    }

    // Vérifier que l'utilisateur a le droit d'accéder à ce rapport
    if (report.generatedBy._id.toString() !== req.user.id && 
        !req.user.roles.includes(ROLES.SUPER_ADMIN)) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à accéder à ce rapport'
      });
    }

    // Si le rapport est en cours de génération
    if (report.status === 'processing') {
      return res.json({
        success: true,
        data: {
          ...report,
          message: 'Le rapport est en cours de génération'
        }
      });
    }

    // Si le rapport a échoué
    if (report.status === 'failed') {
      return res.status(500).json({
        success: false,
        message: 'Échec de la génération du rapport',
        error: report.error
      });
    }

    // Si le rapport est prêt
    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error(`Erreur lors de la récupération du rapport: ${error.message}`, { error });
    next(error);
  }
};

// All functions are already exported using module.exports.functionName
// So we don't need to export them again
