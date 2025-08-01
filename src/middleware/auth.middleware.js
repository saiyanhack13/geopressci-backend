const jwt = require('jsonwebtoken');
const { User } = require('../models/user.model');
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
      // Essayer d'abord avec le modèle User (discriminator base)
      let user = await User.findById(decoded.id).select('-password');
      
      // Si pas trouvé avec User, essayer directement dans les collections spécifiques
      if (!user) {
        console.log('🔍 Utilisateur non trouvé avec User.findById, recherche dans les collections spécifiques...');
        console.log('🔍 ID recherché:', decoded.id, 'Type:', typeof decoded.id);
        
        // Essayer de trouver dans la collection clients
        const Client = require('../models/client.model');
        console.log('🔍 Recherche dans Client...');
        user = await Client.findById(decoded.id).select('-password');
        console.log('🔍 Résultat Client:', user ? 'TROUVÉ' : 'NON TROUVÉ');
        
        // Si toujours pas trouvé, essayer dans la collection pressings
        if (!user) {
          const Pressing = require('../models/pressing.model');
          console.log('🔍 Recherche dans Pressing...');
          user = await Pressing.findById(decoded.id).select('-password');
          console.log('🔍 Résultat Pressing:', user ? 'TROUVÉ' : 'NON TROUVÉ');
        }
        
        // Si toujours pas trouvé, essayer dans la collection admins
        if (!user) {
          const Admin = require('../models/admin.model');
          console.log('🔍 Recherche dans Admin...');
          user = await Admin.findById(decoded.id).select('-password');
          console.log('🔍 Résultat Admin:', user ? 'TROUVÉ' : 'NON TROUVÉ');
        }
        
        // Recherche directe dans MongoDB comme fallback
        if (!user) {
          console.log('🔍 Recherche directe dans MongoDB comme fallback...');
          const mongoose = require('mongoose');
          
          try {
            // Vérifier dans la collection clients d'abord
            const clientsCollection = mongoose.connection.db.collection('clients');
            const userInClients = await clientsCollection.findOne({ _id: new mongoose.Types.ObjectId(decoded.id) });
            console.log('🔍 Dans collection clients:', userInClients ? 'TROUVE' : 'NON TROUVE');
            
            if (userInClients) {
              console.log('✅ Utilisateur trouve dans clients, creation d\'un objet utilisateur temporaire');
              
              // Créer un objet utilisateur temporaire compatible
              user = {
                _id: userInClients._id,
                id: userInClients._id,
                email: userInClients.email,
                nom: userInClients.nom,
                prenom: userInClients.prenom,
                role: userInClients.role || 'client',
                phone: userInClients.phone,
                isActive: userInClients.isActive !== false,
                createdAt: userInClients.createdAt,
                updatedAt: userInClients.updatedAt,
                // Ajouter les méthodes nécessaires
                constructor: { modelName: 'Client' },
                toObject: function() { return this; },
                toJSON: function() { return this; }
              };
              
              console.log('✅ Objet utilisateur temporaire cree:', {
                id: user._id,
                email: user.email,
                role: user.role
              });
            }
            
            // Si pas trouvé dans clients, vérifier dans users
            if (!user) {
              const usersCollection = mongoose.connection.db.collection('users');
              const userInUsers = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(decoded.id) });
              console.log('🔍 Dans collection users:', userInUsers ? 'TROUVE' : 'NON TROUVE');
              
              if (userInUsers) {
                user = {
                  _id: userInUsers._id,
                  id: userInUsers._id,
                  email: userInUsers.email,
                  nom: userInUsers.nom,
                  prenom: userInUsers.prenom,
                  role: userInUsers.role,
                  phone: userInUsers.phone,
                  isActive: userInUsers.isActive !== false,
                  createdAt: userInUsers.createdAt,
                  updatedAt: userInUsers.updatedAt,
                  constructor: { modelName: userInUsers.role === 'pressing' ? 'Pressing' : 'User' },
                  toObject: function() { return this; },
                  toJSON: function() { return this; }
                };
              }
            }
          } catch (error) {
            console.log('❌ Erreur lors de la recherche directe MongoDB:', error.message);
          }
        }
      }
      
      if (!user) {
        console.log('❌ Utilisateur non trouvé avec ID:', decoded.id);
        return res.status(401).json({
          success: false,
          message: 'Non autorisé, utilisateur non trouvé',
        });
      }
      
      // Ajouter les propriétés nécessaires pour la compatibilité
      req.user = user;
      req.user.type = decoded.type || user.constructor.modelName.toLowerCase();
      
      console.log('✅ Utilisateur authentifié:', { 
        id: req.user._id, 
        email: req.user.email, 
        role: req.user.role,
        type: req.user.type,
        modelName: user.constructor.modelName
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
      
      res.status(401).json({
        success: false,
        message,
        error: error.message
      });
    }
  }

  if (!token) {
    res.status(401).json({
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
    // Convertir les rôles et le rôle de l'utilisateur en minuscules pour une comparaison insensible à la casse
    const userRole = req.user.role ? req.user.role.toLowerCase() : '';
    const allowedRoles = roles.map(role => role.toLowerCase());
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Le rôle ${req.user.role} n'est pas autorisé à accéder à cette ressource`,
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize,
};
