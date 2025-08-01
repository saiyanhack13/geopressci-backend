const User = require('../models/user.model');
const Client = require('../models/client.model');
const Pressing = require('../models/pressing.model');
const { ErrorResponse, NotFoundError } = require('../utils/error.utils');

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Récupérer le profil de l'utilisateur connecté
 *     description: Récupère les informations du profil de l'utilisateur actuellement authentifié
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Client'
 *                     - $ref: '#/components/schemas/Pressing'
 *                     - $ref: '#/components/schemas/Admin'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getMe = async (req, res, next) => {
  try {
    // Utiliser le modèle approprié en fonction du type d'utilisateur
    let user;
    if (req.user.role === 'client') {
      user = await Client.findById(req.user.id);
    } else if (req.user.role === 'pressing') {
      user = await Pressing.findById(req.user.id);
    } else {
      user = await User.findById(req.user.id);
    }

    if (!user) {
      throw new NotFoundError('Utilisateur non trouvé');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Mettre à jour le profil de l'utilisateur connecté
 *     description: Permet à un utilisateur de mettre à jour ses informations personnelles
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *                 description: Nouveau nom de famille
 *                 example: 'Doe'
 *               prenom:
 *                 type: string
 *                 description: Nouveau prénom
 *                 example: 'John'
 *               telephone:
 *                 type: string
 *                 description: Nouveau numéro de téléphone
 *                 example: '+2250700000000'
 *               adresse:
 *                 type: string
 *                 description: Nouvelle adresse (pour les clients)
 *                 example: "Cocody, Abidjan, Côte d'Ivoire"
 *     responses:
 *       200:
 *         description: Profil utilisateur mis à jour avec succès
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
 *                   example: 'Profil mis à jour avec succès'
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Client'
 *                     - $ref: '#/components/schemas/Pressing'
 *                     - $ref: '#/components/schemas/Admin'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateMe = async (req, res, next) => {
  try {
    const { nom, prenom, telephone } = req.body;
    const fieldsToUpdate = {};

    if (nom) fieldsToUpdate.nom = nom;
    if (prenom) fieldsToUpdate.prenom = prenom;
    if (telephone) fieldsToUpdate.telephone = telephone;

    // Utiliser le modèle approprié en fonction du type d'utilisateur
    let user;
    if (req.user.role === 'client') {
      user = await Client.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
        new: true,
        runValidators: true,
      });
    } else if (req.user.role === 'pressing') {
      user = await Pressing.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
        new: true,
        runValidators: true,
      });
    } else {
      user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
        new: true,
        runValidators: true,
      });
    }

    if (!user) {
      throw new NotFoundError('Utilisateur non trouvé');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /users/update-password:
 *   put:
 *     summary: Mettre à jour le mot de passe de l'utilisateur connecté
 *     description: Permet à un utilisateur de modifier son mot de passe
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: Mot de passe actuel
 *                 example: 'ancienMotDePasse123'
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: Nouveau mot de passe
 *                 example: 'nouveauMotDePasse123'
 *               confirmNewPassword:
 *                 type: string
 *                 format: password
 *                 description: Confirmation du nouveau mot de passe
 *                 example: 'nouveauMotDePasse123'
 *     responses:
 *       200:
 *         description: Mot de passe mis à jour avec succès
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
 *                   example: 'Mot de passe mis à jour avec succès'
 *       400:
 *         description: Erreur de validation ou mot de passe actuel incorrect
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
 *                   example: 'Le mot de passe actuel est incorrect'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Vérifier que les mots de passe sont fournis
    if (!currentPassword || !newPassword) {
      throw new ErrorResponse('Veuillez fournir l\'ancien et le nouveau mot de passe', 400);
    }

    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      throw new NotFoundError('Utilisateur non trouvé');
    }

    // Vérifier l'ancien mot de passe
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new ErrorResponse('Mot de passe actuel incorrect', 401);
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    // Générer un nouveau token
    const token = user.getSignedJwtToken();

    res.json({
      success: true,
      token,
      message: 'Mot de passe mis à jour avec succès',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Récupérer tous les utilisateurs (Admin uniquement)
 *     description: Permet à un administrateur de récupérer la liste de tous les utilisateurs
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Nombre d'utilisateurs par page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [client, pressing, admin]
 *         description: Filtrer par rôle d'utilisateur
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [date_asc, date_desc, nom_asc, nom_desc]
 *           default: 'date_desc'
 *         description: Critère de tri
 *     responses:
 *       200:
 *         description: Liste des utilisateurs récupérée avec succès
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
 *                   description: Nombre total d'utilisateurs
 *                   example: 150
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
 *                     oneOf:
 *                       - $ref: '#/components/schemas/Client'
 *                       - $ref: '#/components/schemas/Pressing'
 *                       - $ref: '#/components/schemas/Admin'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Récupérer un utilisateur par son ID (Admin uniquement)
 *     description: Permet à un administrateur de récupérer les détails d'un utilisateur spécifique
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur à récupérer
 *     responses:
 *       200:
 *         description: Détails de l'utilisateur récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Client'
 *                     - $ref: '#/components/schemas/Pressing'
 *                     - $ref: '#/components/schemas/Admin'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      throw new NotFoundError(`Aucun utilisateur avec l'ID ${req.params.id}`);
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/users/{id}:
 *   put:
 *     summary: Mettre à jour un utilisateur (Admin uniquement)
 *     description: Permet à un administrateur de mettre à jour les informations d'un utilisateur
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *                 description: Nouveau nom de famille
 *                 example: 'Doe'
 *               prenom:
 *                 type: string
 *                 description: Nouveau prénom
 *                 example: 'John'
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Nouvelle adresse email
 *                 example: 'john.doe@example.com'
 *               telephone:
 *                 type: string
 *                 description: Nouveau numéro de téléphone
 *                 example: '+2250700000000'
 *               actif:
 *                 type: boolean
 *                 description: Statut d'activation du compte
 *                 example: true
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour avec succès
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
 *                   example: 'Utilisateur mis à jour avec succès'
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Client'
 *                     - $ref: '#/components/schemas/Pressing'
 *                     - $ref: '#/components/schemas/Admin'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updateUser = async (req, res, next) => {
  try {
    const { nom, prenom, email, telephone, role } = req.body;
    const fieldsToUpdate = {};

    if (nom) fieldsToUpdate.nom = nom;
    if (prenom) fieldsToUpdate.prenom = prenom;
    if (email) fieldsToUpdate.email = email;
    if (telephone) fieldsToUpdate.telephone = telephone;
    if (role) fieldsToUpdate.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      throw new NotFoundError(`Aucun utilisateur avec l'ID ${req.params.id}`);
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Supprimer un utilisateur (Admin uniquement)
 *     description: Permet à un administrateur de supprimer définitivement un utilisateur du système
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur à supprimer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               raison:
 *                 type: string
 *                 description: Raison de la suppression (optionnel)
 *                 example: "Compte inactif depuis plus d'un an"
 *     responses:
 *       200:
 *         description: Utilisateur supprimé avec succès
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
 *                   example: 'Utilisateur supprimé avec succès'
 *       400:
 *         description: Impossible de supprimer cet utilisateur
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
 *                   example: 'Impossible de supprimer un compte administrateur principal'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      throw new NotFoundError(`Aucun utilisateur avec l'ID ${req.params.id}`);
    }

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  updateMe,
  updatePassword,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
};
