const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Admin = require('../models/admin.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('./async');
const logger = require('../utils/logger');

// Protéger les routes
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Vérifier le token dans le header Authorization
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Vérifier le token dans les cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Vérifier si le token existe
  if (!token) {
    return next(
      new ErrorResponse('Non autorisé à accéder à cette route', 401)
    );
  }

  try {
    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérifier si l'utilisateur existe toujours
    let user;
    
    if (decoded.role === 'admin') {
      user = await Admin.findById(decoded.id);
    } else {
      user = await User.findById(decoded.id);
    }

    if (!user) {
      return next(
        new ErrorResponse('Aucun utilisateur trouvé avec cet ID', 404)
      );
    }

    // Vérifier si le compte est actif (pour les administrateurs)
    if (user.status && user.status !== 'active' && decoded.role === 'admin') {
      return next(
        new ErrorResponse('Ce compte administrateur a été désactivé', 401)
      );
    }

    // Ajouter l'utilisateur à l'objet requête
    req.user = user;
    req.user.role = decoded.role;
    
    next();
  } catch (err) {
    logger.error(`Erreur d'authentification: ${err.message}`);
    return next(
      new ErrorResponse('Non autorisé à accéder à cette route', 401)
    );
  }
});

// Autoriser des rôles spécifiques
const authorize = (...roles) => {
  return (req, res, next) => {
    // Vérifier si l'utilisateur a le bon rôle
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `Le rôle ${req.user.role} n'est pas autorisé à accéder à cette route`,
          403
        )
      );
    }
    next();
  };
};

// Vérifier les permissions spécifiques (pour les administrateurs)
const checkPermissions = (...permissions) => {
  return (req, res, next) => {
    // Les super administrateurs ont toutes les permissions
    if (req.user.isSuperAdmin) {
      return next();
    }
    
    // Vérifier si l'utilisateur a au moins une des permissions requises
    const hasPermission = permissions.some(permission => 
      req.user.permissions && req.user.permissions.includes(permission)
    );
    
    if (!hasPermission) {
      return next(
        new ErrorResponse(
          'Vous n\'êtes pas autorisé à effectuer cette action',
          403
        )
      );
    }
    
    next();
  };
};

module.exports = {
  protect,
  authorize,
  checkPermissions
};
