const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
// Importer les modèles selon l'architecture corrigée (collections séparées)
const Client = require('../models/client.model');
const Pressing = require('../models/pressing.model');
const Admin = require('../models/admin.model');
const config = require('../config/config');

/**
 * Middleware pour protéger les routes avec JWT
 */
const protect = async (req, res, next) => {
  let token;

  // Vérifier si le token est présent dans le header Authorization
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extraire le token du header
      token = req.headers.authorization.split(' ')[1];
      console.log('🔍 Auth Middleware - Token reçu:', token ? `${token.substring(0, 20)}...` : 'null');

      // Vérifier et décoder le token
      const decoded = jwt.verify(token, config.jwt.secret);
      console.log('✅ Token décodé avec succès:', { userId: decoded.id, iat: decoded.iat, exp: decoded.exp });

      // Récupérer l'utilisateur à partir du token décodé
      // Rechercher dans les collections séparées selon l'architecture corrigée
      let user = null;
      console.log('🔍 Recherche de l\'utilisateur dans les collections séparées...');
      console.log('🔍 ID recherché:', decoded.id, 'Type:', typeof decoded.id);
      
      // Convertir l'ID en ObjectId si nécessaire
      let userId;
      try {
        userId = mongoose.Types.ObjectId.isValid(decoded.id) ? new mongoose.Types.ObjectId(decoded.id) : decoded.id;
        console.log('🔍 ObjectId converti:', userId);
      } catch (error) {
        console.log('❌ Erreur conversion ObjectId:', error.message);
        userId = decoded.id;
      }
      
      try {
        // Recherche dans la collection pressings
        console.log('🔍 Recherche dans collection pressings...');
        user = await Pressing.findById(userId).select('-password');
        if (user) {
          console.log('✅ Pressing trouvé:', {
            id: user._id,
            email: user.email,
            businessName: user.businessName,
            role: user.role
          });
          user.type = 'pressing';
          user.modelName = 'Pressing';
        }
      } catch (error) {
        console.log('❌ Erreur lors de la recherche Pressing:', error.message);
      }
      
      // Si pas trouvé dans pressings, chercher dans clients
      if (!user) {
        try {
          console.log('🔍 Recherche dans collection clients...');
          console.log('🔍 Utilisation du modèle Client avec userId:', userId);
          
          // Test direct avec la collection
          const directClient = await Client.collection.findOne({ _id: userId });
          console.log('🔍 Recherche directe collection clients:', directClient ? 'TROUVÉ' : 'NON TROUVÉ');
          
          user = await Client.findById(userId).select('-password');
          console.log('🔍 Résultat Client.findById:', user ? 'TROUVÉ' : 'NON TROUVÉ');
          
          if (user) {
            console.log('✅ Client trouvé:', {
              id: user._id,
              email: user.email,
              nom: user.nom,
              prenom: user.prenom,
              role: user.role
            });
            user.type = 'client';
            user.modelName = 'Client';
          }
        } catch (error) {
          console.log('❌ Erreur lors de la recherche Client:', error.message);
          console.log('❌ Stack trace:', error.stack);
        }
      }
      
      // Si pas trouvé dans clients, chercher dans admins
      if (!user) {
        try {
          console.log('🔍 Recherche dans collection admins...');
          user = await Admin.findById(userId).select('-password');
          if (user) {
            console.log('✅ Admin trouvé:', {
              id: user._id,
              email: user.email,
              nom: user.nom,
              prenom: user.prenom,
              role: user.role
            });
            user.type = 'admin';
            user.modelName = 'Admin';
          }
        } catch (error) {
          console.log('❌ Erreur lors de la recherche Admin:', error.message);
        }
      }
      
      // Plus de fallback vers users - architecture corrigée avec collections séparées
      
      if (!user) {
        console.log('❌ Utilisateur non trouvé avec ID:', decoded.id);
        return res.status(401).json({
          success: false,
          message: 'Non autorisé, utilisateur non trouvé',
        });
      }
      
      // Ajouter les propriétés nécessaires pour la compatibilité
      req.user = user;
      
      // Normaliser le rôle (toujours en minuscules)
      if (req.user.role && typeof req.user.role === 'string') {
        req.user.role = req.user.role.toLowerCase();
      } else if (req.user.type) {
        // Utiliser le type défini lors de la recherche
        req.user.role = req.user.type.toLowerCase();
      } else {
        // Fallback basé sur le modelName
        req.user.role = req.user.modelName ? req.user.modelName.toLowerCase() : 'client';
      }
      
      // Définir le type pour la compatibilité
      req.user.type = req.user.role;
      
      console.log('✅ Utilisateur authentifié:', { 
        id: req.user._id, 
        email: req.user.email, 
        role: req.user.role,
        type: req.user.type,
        modelName: req.user.modelName || 'N/A'
      });
      next();
    } catch (error) {
      console.error('❌ Erreur d\'authentification:', {
        name: error.name,
        message: error.message,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'null'
      });
      
      let message = 'Non autorisé, token invalide';
      if (error.name === 'TokenExpiredError') {
        message = 'Token expiré, veuillez vous reconnecter';
      } else if (error.name === 'JsonWebTokenError') {
        message = 'Token malformé';
      }
      
      return res.status(401).json({
        success: false,
        message,
        error: error.message
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Non autorisé, aucun token fourni',
    });
  }
};

/**
 * Middleware pour restreindre l'accès en fonction du rôle
 * @param {...string} roles - Rôles autorisés
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Vérifier que l'utilisateur existe
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non authentifié',
      });
    }
    
    // Normaliser le rôle utilisateur (gérer les cas où role n'est pas une string)
    let userRole = '';
    if (req.user.role && typeof req.user.role === 'string') {
      userRole = req.user.role.toLowerCase();
    } else if (req.user.type && typeof req.user.type === 'string') {
      userRole = req.user.type.toLowerCase();
    } else if (req.user.constructor && req.user.constructor.modelName) {
      userRole = req.user.constructor.modelName.toLowerCase();
    }
    
    // Aplatir les rôles (gérer les tableaux et les paramètres séparés)
    let flattenedRoles = [];
    for (const role of roles) {
      if (Array.isArray(role)) {
        // Si c'est un tableau, l'aplatir
        flattenedRoles.push(...role);
      } else {
        // Si c'est un paramètre simple
        flattenedRoles.push(role);
      }
    }
    
    // Convertir les rôles autorisés en minuscules
    const allowedRoles = flattenedRoles.map(role => {
      if (typeof role === 'string') {
        return role.toLowerCase();
      }
      return String(role).toLowerCase();
    });
    
    console.log('🔍 Vérification autorisation:', {
      userRole,
      allowedRoles,
      originalUserRole: req.user.role,
      userType: req.user.type,
      originalRoles: roles,
      flattenedRoles
    });
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Seuls les ${allowedRoles.join(', ')} peuvent accéder à cette ressource.`,
      });
    }
    
    next();
  };
};

module.exports = {
  protect,
  authorize,
};
