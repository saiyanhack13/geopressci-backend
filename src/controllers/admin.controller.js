const Admin = require('../models/admin.model');
const Pressing = require('../models/pressing.model');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { sendEmail } = require('../services/email.service');

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     summary: Authentification administrateur
 *     description: Authentifie un administrateur et retourne un jeton JWT pour les requêtes ultérieures
 *     tags: [Administration - Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email de l'administrateur
 *                 example: admin@geopressci.ci
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Mot de passe de l'administrateur
 *                 example: V0tr3M0tD3P4ss3S3cUr1s3
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   description: JWT token à utiliser pour les requêtes authentifiées
 *                   example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: '5f8d8f9d8f9d8f9d8f9d8f9d'
 *                         email:
 *                           type: string
 *                           format: email
 *                           example: admin@geopressci.ci
 *                         fullName:
 *                           type: string
 *                           example: 'Admin Principal'
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ['users:read', 'users:write', 'pressings:manage']
 *                         isSuperAdmin:
 *                           type: boolean
 *                           example: true
 *       400:
 *         description: Données de connexion manquantes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Veuillez fournir un email et un mot de passe'
 *       401:
 *         description: Identifiants invalides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Identifiants invalides'
 *       403:
 *         description: Compte désactivé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Votre compte a été désactivé. Veuillez contacter le support.'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Vérifier si l'email et le mot de passe sont fournis
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un email et un mot de passe'
      });
    }

    // Vérifier si l'administrateur existe
    const admin = await Admin.findOne({ email }).select('+password');
    
    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Vérifier si le compte est actif
    if (admin.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Votre compte a été désactivé. Veuillez contacter le support.'
      });
    }

    // Mettre à jour la dernière connexion
    admin.lastLogin = Date.now();
    await admin.save();

    // Créer le token JWT
    const token = jwt.sign(
      { id: admin._id, role: 'admin' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Envoyer la réponse
    res.status(200).json({
      success: true,
      token,
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          fullName: admin.fullName,
          permissions: admin.permissions,
          isSuperAdmin: admin.isSuperAdmin
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin:
 *   post:
 *     summary: Créer un nouvel administrateur
 *     description: Permet à un super administrateur de créer un nouveau compte administrateur
 *     tags: [Administration - Gestion des Admins]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email de l'administrateur
 *                 example: admin2@geopressci.ci
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Mot de passe de l'administrateur (8 caractères minimum)
 *                 example: P@ssw0rd123
 *               fullName:
 *                 type: string
 *                 description: Nom complet de l'administrateur
 *                 example: 'Jean Dupont'
 *               phone:
 *                 type: string
 *                 description: Numéro de téléphone de l'administrateur
 *                 example: '+2250701020304'
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [users:read, users:write, pressings:read, pressings:write, pressings:approve, pressings:manage, admins:read, admins:manage, settings:read, settings:write, billing:read, billing:manage, reports:view, notifications:send]
 *                 description: Liste des permissions accordées à l'administrateur
 *                 example: ['users:read', 'pressings:manage']
 *     responses:
 *       201:
 *         description: Administrateur créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: '5f8d8f9d8f9d8f9d8f9d8f9e'
 *                         email:
 *                           type: string
 *                           format: email
 *                           example: admin2@geopressci.ci
 *                         fullName:
 *                           type: string
 *                           example: 'Jean Dupont'
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ['users:read', 'pressings:manage']
 *       400:
 *         description: Données invalides ou administrateur existant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   oneOf:
 *                     - example: 'Veuillez fournir un email, un mot de passe et un nom complet'
 *                     - example: 'Un administrateur avec cet email existe déjà'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Action non autorisée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Non autorisé. Seul un super administrateur peut créer un administrateur.'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
exports.createAdmin = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est un super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé. Seul un super administrateur peut créer un administrateur.'
      });
    }

    const { email, password, fullName, phone, permissions } = req.body;

    // Vérifier si l'administrateur existe déjà
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Un administrateur avec cet email existe déjà'
      });
    }

    // Créer le nouvel administrateur
    const admin = await Admin.create({
      email,
      password,
      fullName,
      phone,
      permissions: permissions || []
    });

    // Envoyer un email de bienvenue avec les identifiants
    const welcomeEmail = {
      to: admin.email,
      subject: 'Bienvenue sur le panneau d\'administration GeoPressCI',
      text: `Bonjour ${admin.fullName},\n\nVotre compte administrateur a été créé avec succès.\n\nEmail: ${admin.email}\nMot de passe: ${password}\n\nVeuillez changer votre mot de passe après votre première connexion.\n\nCordialement,\nL'équipe GeoPressCI`
    };

    try {
      await sendEmail(welcomeEmail);
    } catch (error) {
      logger.error(`Erreur lors de l'envoi de l'email de bienvenue: ${error.message}`);
    }

    res.status(201).json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          fullName: admin.fullName,
          permissions: admin.permissions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin:
 *   get:
 *     summary: Récupérer la liste des administrateurs
 *     description: Permet à un super administrateur de récupérer la liste de tous les administrateurs du système
 *     tags: [Administration - Gestion des Admins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         description: Filtrer les administrateurs par statut
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Terme de recherche pour filtrer par nom ou email
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name_asc, name_desc, email_asc, email_desc, created_asc, created_desc]
 *         description: Trier les résultats
 *         example: 'name_asc'
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Nombre maximum d'administrateurs à retourner
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Numéro de la page à récupérer
 *     responses:
 *       200:
 *         description: Liste des administrateurs récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Nombre total d'administrateurs correspondant aux critères
 *                   example: 5
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 10
 *                     totalPages:
 *                       type: integer
 *                       example: 1
 *                     totalItems:
 *                       type: integer
 *                       example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Admin'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Accès refusé - Réservé aux super administrateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Non autorisé. Seul un super administrateur peut voir la liste des administrateurs.'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * components:
 *   schemas:
 *     Admin:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: '5f8d8f9d8f9d8f9d8f9d8f9d'
 *         email:
 *           type: string
 *           format: email
 *           example: 'admin@geopressci.ci'
 *         fullName:
 *           type: string
 *           example: 'Jean Dupont'
 *         phone:
 *           type: string
 *           example: '+2250701020304'
 *         isSuperAdmin:
 *           type: boolean
 *           example: false
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended]
 *           example: 'active'
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           example: ['users:read', 'pressings:manage']
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           example: '2023-10-15T14:30:00.000Z'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2023-10-01T10:00:00.000Z'
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: '2023-10-10T15:45:00.000Z'
 */
exports.getAdmins = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est un super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé. Seul un super administrateur peut voir la liste des administrateurs.'
      });
    }

    const admins = await Admin.find({}).select('-password -twoFactorSecret -resetPasswordToken -resetPasswordExpire');
    
    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/{id}:
 *   put:
 *     summary: Mettre à jour un administrateur
 *     description: Permet de mettre à jour les informations d'un administrateur existant
 *     tags: [Administration - Gestion des Admins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'administrateur à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: Nouveau nom complet de l'administrateur
 *                 example: 'Jean Dupont Modifié'
 *               phone:
 *                 type: string
 *                 description: Nouveau numéro de téléphone
 *                 example: '+2250702030405'
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *                 description: Nouveau statut du compte (uniquement modifiable par un super admin)
 *                 example: 'active'
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [users:read, users:write, pressings:read, pressings:write, pressings:approve, pressings:manage, admins:read, admins:manage, settings:read, settings:write, billing:read, billing:manage, reports:view, notifications:send]
 *                 description: Nouvelles permissions (uniquement modifiables par un super admin)
 *                 example: ['users:read', 'pressings:manage']
 *     responses:
 *       200:
 *         description: Administrateur mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Admin'
 *       400:
 *         description: Données invalides ou erreur de validation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   description: Description de l'erreur
 *                   example: 'Validation error: Phone number is invalid'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Action non autorisée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   oneOf:
 *                     - example: 'Non autorisé. Vous ne pouvez pas modifier ce compte.'
 *                     - example: 'Action réservée aux super administrateurs'
 *       404:
 *         description: Administrateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Aucun administrateur trouvé avec cet ID'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
exports.updateAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, phone, status, permissions } = req.body;
    
    // Vérifier si l'utilisateur est le propriétaire ou un super admin
    if (req.user.id !== id && !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé. Vous ne pouvez pas modifier ce compte.'
      });
    }

    // Construire l'objet de mise à jour
    const updateFields = {};
    if (fullName) updateFields.fullName = fullName;
    if (phone) updateFields.phone = phone;
    
    // Seul un super admin peut modifier le statut et les permissions
    if (req.user.isSuperAdmin) {
      if (status) updateFields.status = status;
      if (permissions) updateFields.permissions = permissions;
    }

    const admin = await Admin.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret -resetPasswordToken -resetPasswordExpire');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrateur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: admin
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/{id}:
 *   delete:
 *     summary: Supprimer un administrateur
 *     description: Permet à un super administrateur de supprimer un compte administrateur existant
 *     tags: [Administration - Gestion des Admins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'administrateur à supprimer
 *     responses:
 *       200:
 *         description: Administrateur supprimé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: '5f8d8f9d8f9d8f9d8f9d8f9d'
 *                     message:
 *                       type: string
 *                       example: 'Administrateur supprimé avec succès'
 *       400:
 *         description: Tentative de suppression de son propre compte
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Vous ne pouvez pas supprimer votre propre compte.'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Action non autorisée - Réservé aux super administrateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Non autorisé. Seul un super administrateur peut supprimer un administrateur.'
 *       404:
 *         description: Administrateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 'Aucun administrateur trouvé avec cet ID'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
exports.deleteAdmin = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est un super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé. Seul un super administrateur peut supprimer un administrateur.'
      });
    }

    // Empêcher l'auto-suppression
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte.'
      });
    }

    const admin = await Admin.findByIdAndDelete(req.params.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrateur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     summary: Obtenir les statistiques du système
 *     description: Récupère les statistiques globales du système pour le tableau de bord d'administration
 *     tags: [Administration - Tableau de bord]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques du système récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPressings:
 *                       type: integer
 *                       description: Nombre total de pressings inscrits
 *                       example: 125
 *                     activePressings:
 *                       type: integer
 *                       description: Nombre de pressings avec un abonnement actif
 *                       example: 87
 *                     trialingPressings:
 *                       type: integer
 *                       description: Nombre de pressings en période d'essai
 *                       example: 25
 *                     totalRevenue:
 *                       type: number
 *                       description: Chiffre d'affaires total (en XOF)
 *                       example: 435000
 *                     monthlyRevenue:
 *                       type: number
 *                       description: Chiffre d'affaires du mois en cours (en XOF)
 *                       example: 25000
 *                     pendingVerifications:
 *                       type: integer
 *                       description: Nombre de vérifications d'identité en attente
 *                       example: 13
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Action non autorisée - Droits insuffisants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Non autorisé. Vous n'avez pas la permission de voir les statistiques."
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
exports.getSystemStats = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur a la permission de voir les statistiques
    if (!req.user.permissions.includes('view_analytics') && !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé. Vous n\'avez pas la permission de voir les statistiques.'
      });
    }

    const [
      totalPressings,
      activePressings,
      trialingPressings,
      totalRevenue,
      monthlyRevenue,
      pendingVerifications
    ] = await Promise.all([
      // Nombre total de pressings
      Pressing.countDocuments(),
      
      // Nombre de pressings avec abonnement actif
      Pressing.countDocuments({ subscriptionStatus: 'active' }),
      
      // Nombre de pressings en période d'essai
      Pressing.countDocuments({ 
        subscriptionStatus: 'trialing',
        trialEndDate: { $gt: new Date() }
      }),
      
      // Chiffre d'affaires total (simulé)
      Pressing.aggregate([
        { $match: { subscriptionStatus: 'active' } },
        { $group: { _id: null, total: { $sum: 5000 } } } // 5000 XOF par pressing actif
      ]),
      
      // Chiffre d'affaires mensuel (simulé)
      Pressing.aggregate([
        { 
          $match: { 
            subscriptionStatus: 'active',
            subscriptionStartDate: { 
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
              $lte: new Date()
            }
          }
        },
        { $group: { _id: null, total: { $sum: 5000 } } } // 5000 XOF par nouvel abonnement ce mois-ci
      ]),
      
      // Nombre de vérifications d'identité en attente
      Pressing.countDocuments({ verificationStatus: 'en_attente' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPressings,
        activePressings,
        trialingPressings,
        totalRevenue: totalRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        pendingVerifications
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/pressings:
 *   get:
 *     summary: Obtenir la liste des pressings avec filtres
 *     description: Récupère une liste paginée des pressings avec possibilité de filtrage par statut et vérification
 *     tags: [Administration - Gestion des Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, trialing, past_due, canceled, unpaid]
 *         description: Filtrer par statut d'abonnement
 *       - in: query
 *         name: verification
 *         schema:
 *           type: string
 *           enum: [en_attente, approuve, rejete, non_soumis]
 *         description: Filtrer par statut de vérification d'identité
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Numéro de la page à récupérer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Nombre d'éléments par page (max 100)
 *     responses:
 *       200:
 *         description: Liste des pressings récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Nombre de pressings dans la page actuelle
 *                   example: 10
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     next:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 2
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                     prev:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Pressing'
 *       400:
 *         description: Paramètres de requête invalides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Le paramètre 'page' doit être un nombre entier positif"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Action non autorisée - Droits insuffisants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Non autorisé. Vous n'avez pas la permission de gérer les pressings."
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
exports.getPressings = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur a la permission de gérer les pressings
    if (!req.user.permissions.includes('manage_pressings') && !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé. Vous n\'avez pas la permission de gérer les pressings.'
      });
    }

    // Construire l'objet de requête
    const query = {};
    
    // Filtres
    if (req.query.status) {
      query.subscriptionStatus = req.query.status;
    }
    
    if (req.query.verification) {
      query.verificationStatus = req.query.verification;
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Pressing.countDocuments(query);

    // Exécuter la requête avec pagination
    const pressings = await Pressing.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: pressings.length,
      pagination,
      data: pressings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/pressings/{id}:
 *   put:
 *     summary: Mettre à jour un pressing (par admin)
 *     description: Permet à un administrateur de mettre à jour les informations d'un pressing
 *     tags: [Administration - Gestion des Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessName:
 *                 type: string
 *                 description: Nouveau nom de l'entreprise
 *                 example: "Nouveau Nom du Pressing"
 *               phone:
 *                 type: string
 *                 description: Nouveau numéro de téléphone
 *                 example: "+2250702030405"
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: "Rue des Pressings"
 *                   city:
 *                     type: string
 *                     example: "Abidjan"
 *                   postalCode:
 *                     type: string
 *                     example: "01 BP 1234"
 *               subscriptionStatus:
 *                 type: string
 *                 enum: [active, trialing, past_due, canceled, unpaid]
 *                 description: Statut de l'abonnement (uniquement modifiable par admin)
 *                 example: "active"
 *               verificationStatus:
 *                 type: string
 *                 enum: [en_attente, approuve, rejete, non_soumis]
 *                 description: Statut de vérification d'identité
 *                 example: "approuve"
 *               isActive:
 *                 type: boolean
 *                 description: Si le compte est actif (désactive le compte si false)
 *                 example: true
 *     responses:
 *       200:
 *         description: Pressing mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Pressing'
 *       400:
 *         description: Données de mise à jour invalides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Le numéro de téléphone est invalide"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Action non autorisée - Droits insuffisants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Non autorisé. Vous n'avez pas la permission de gérer les pressings."
 *       404:
 *         description: Pressing non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Aucun pressing trouvé avec cet ID"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
exports.updatePressing = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur a la permission de gérer les pressings
    if (!req.user.permissions.includes('manage_pressings') && !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé. Vous n\'avez pas la permission de gérer les pressings.'
      });
    }

    const { id } = req.params;
    const updateFields = { ...req.body };

    // Ne pas permettre la modification de certains champs sensibles
    const restrictedFields = ['password', 'email', 'role'];
    restrictedFields.forEach(field => delete updateFields[field]);

    // Si la vérification est approuvée, mettre à jour la date de vérification
    if (updateFields.verificationStatus === 'approuve') {
      updateFields.verificationDate = new Date();
    }

    const pressing = await Pressing.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Envoyer une notification si le statut de vérification a changé
    if (updateFields.verificationStatus) {
      // Ici, vous pouvez ajouter la logique pour envoyer une notification au pressing
      logger.info(`Statut de vérification mis à jour pour le pressing ${pressing._id}: ${updateFields.verificationStatus}`);
    }

    res.status(200).json({
      success: true,
      data: pressing
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/pressings/{id}:
 *   delete:
 *     summary: Supprimer un pressing (par admin)
 *     description: Permet à un administrateur de supprimer définitivement un compte pressing
 *     tags: [Administration - Gestion des Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing à supprimer
 *     responses:
 *       200:
 *         description: Pressing supprimé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Objet vide indiquant la réussite de l'opération
 *                   example: {}
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Action non autorisée - Droits insuffisants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Non autorisé. Vous n'avez pas la permission de gérer les pressings."
 *       404:
 *         description: Pressing non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Aucun pressing trouvé avec cet ID"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
exports.deletePressing = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur a la permission de gérer les pressings
    if (!req.user.permissions.includes('manage_pressings') && !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé. Vous n\'avez pas la permission de gérer les pressings.'
      });
    }

    const pressing = await Pressing.findByIdAndDelete(req.params.id);

    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Ici, vous pouvez ajouter la logique pour envoyer une notification au pressing
    logger.info(`Pressing supprimé par l'admin: ${pressing._id}`);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/pressings/{id}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'un pressing
 *     description: Permet à un administrateur de changer le statut d'un pressing (approved, rejected, suspended, etc.)
 *     tags: [Administration - Gestion des Pressings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du pressing à mettre à jour
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
 *                 enum: [pending_approval, approved, rejected, suspended, active]
 *                 description: Le nouveau statut du pressing
 *                 example: 'approved'
 *     responses:
 *       200:
 *         description: Statut du pressing mis à jour avec succès
 *       400:
 *         description: Statut invalide ou manquant
 *       404:
 *         description: Pressing non trouvé
 */
exports.updatePressingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatus = ['pending_approval', 'approved', 'rejected', 'suspended', 'active'];
    if (!status || !allowedStatus.includes(status)) {
      return res.status(400).json({ success: false, message: 'Statut fourni invalide ou manquant.' });
    }

    // Récupération du pressing
    const pressing = await Pressing.findById(id);

    if (!pressing) {
      return res.status(404).json({ success: false, message: 'Aucun pressing trouvé avec cet ID.' });
    }

    pressing.status = status;
    if (status === 'approved' && !pressing.approvedAt) {
      pressing.approvedAt = new Date();
    }

    await pressing.save();

    logger.info(`Le statut du pressing ${pressing.businessName} (${pressing._id}) a été mis à jour à "${status}" par l'admin ${req.user.id}.`);

    // Envoyer une notification par email au propriétaire
    if (pressing.owner && pressing.owner.email) {
      try {
        const subject = `Mise à jour du statut de votre pressing : ${pressing.businessName}`;
        const text = `Bonjour ${pressing.owner.fullName || ''},

Le statut de votre pressing "${pressing.businessName}" a été mis à jour par un administrateur.

Nouveau statut : <strong>${status.replace('_', ' ')}</strong>

${status === 'rejected' && pressing.rejectionReason ? `Motif du rejet : ${pressing.rejectionReason}` : ''}
${status === 'approved' ? 'Félicitations ! Votre pressing est maintenant approuvé et visible par les clients.' : ''}
${status === 'suspended' ? 'Votre pressing a été temporairement suspendu. Veuillez contacter le support pour plus d\'informations.' : ''}

Si vous avez des questions, n'hésitez pas à nous contacter.

Cordialement,
L'équipe Geopressci`;

        await sendEmail({
          to: pressing.owner.email,
          subject,
          text, // Utiliser `text` pour un contenu simple ou `html` pour du HTML
        });

        logger.info(`Notification de changement de statut envoyée à ${pressing.owner.email}`);
      } catch (emailError) {
        logger.error(`Échec de l'envoi de l'email de notification pour le pressing ${pressing._id}:`, emailError);
      }
    }

    res.status(200).json({
      success: true,
      data: pressing
    });

  } catch (error) {
    next(error);
  }
};
