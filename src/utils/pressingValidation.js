const { body, validationResult } = require('express-validator');
const ApiError = require('./ApiError');
const httpStatus = require('http-status');

/**
 * Validation avancée pour les données de pressing
 * Renforce la sécurité côté serveur
 */

// Validation pour l'inscription d'un pressing
const validatePressingRegistration = [
  body('prenom')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le prénom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
    
  body('nom')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
    
  body('nomCommerce')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du commerce doit contenir entre 2 et 100 caractères')
    .custom((value) => {
      // Vérifier que le nom ne contient pas de caractères dangereux
      const dangerousChars = /<script|javascript:|data:|vbscript:/i;
      if (dangerousChars.test(value)) {
        throw new Error('Le nom du commerce contient des caractères non autorisés');
      }
      return true;
    }),
    
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Adresse email invalide')
    .custom((value) => {
      // Vérifier que l'email n'est pas dans une liste de domaines suspects
      const suspiciousDomains = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'];
      const domain = value.split('@')[1];
      if (suspiciousDomains.includes(domain)) {
        throw new Error('Ce domaine email n\'est pas autorisé');
      }
      return true;
    }),
    
  body('telephone')
    .matches(/^\+225[0-9]{8,10}$/)
    .withMessage('Le numéro de téléphone doit être au format +225XXXXXXXX (8 à 10 chiffres après +225)'),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le mot de passe doit contenir au moins: 1 minuscule, 1 majuscule, 1 chiffre et 1 caractère spécial'),
    
  body('adresse')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('L\'adresse doit contenir entre 10 et 500 caractères')
    .custom((value) => {
      // Vérifier que l'adresse contient "Abidjan" ou "Côte d'Ivoire"
      if (!value.toLowerCase().includes('abidjan') && !value.toLowerCase().includes('côte d\'ivoire')) {
        throw new Error('L\'adresse doit être située à Abidjan, Côte d\'Ivoire');
      }
      return true;
    }),
    
  body('services')
    .optional()
    .isArray({ min: 1, max: 20 })
    .withMessage('Vous devez proposer entre 1 et 20 services')
    .custom((services) => {
      // Valider chaque service
      for (const service of services) {
        if (!service.nom || typeof service.nom !== 'string' || service.nom.length < 2) {
          throw new Error('Chaque service doit avoir un nom valide');
        }
        if (!service.prix || typeof service.prix !== 'number' || service.prix < 100) {
          throw new Error('Chaque service doit avoir un prix minimum de 100 FCFA');
        }
        if (service.prix > 50000) {
          throw new Error('Le prix d\'un service ne peut pas dépasser 50,000 FCFA');
        }
      }
      return true;
    })
];

// Validation pour la mise à jour du profil pressing
const validatePressingProfileUpdate = [
  body('businessName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du commerce doit contenir entre 2 et 100 caractères'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères')
    .custom((value) => {
      // Vérifier qu'il n'y a pas de contenu malveillant
      const dangerousPatterns = /<script|javascript:|data:|vbscript:|on\w+\s*=/i;
      if (dangerousPatterns.test(value)) {
        throw new Error('La description contient du contenu non autorisé');
      }
      return true;
    }),
    
  body('phone')
    .optional()
    .matches(/^\+225[0-9]{8,10}$/)
    .withMessage('Le numéro de téléphone doit être au format +225XXXXXXXX'),
    
  body('address.coordinates.lat')
    .optional()
    .isFloat({ min: 4.5, max: 6.5 })
    .withMessage('La latitude doit être comprise entre 4.5 et 6.5 (zone Côte d\'Ivoire)'),
    
  body('address.coordinates.lng')
    .optional()
    .isFloat({ min: -8.5, max: -2.5 })
    .withMessage('La longitude doit être comprise entre -8.5 et -2.5 (zone Côte d\'Ivoire)'),
    
  body('businessHours')
    .optional()
    .isArray({ min: 7, max: 7 })
    .withMessage('Les horaires doivent être définis pour les 7 jours de la semaine')
    .custom((hours) => {
      const validDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
      const providedDays = hours.map(h => h.day?.toLowerCase());
      
      // Vérifier que tous les jours sont présents
      for (const day of validDays) {
        if (!providedDays.includes(day)) {
          throw new Error(`Les horaires pour ${day} sont manquants`);
        }
      }
      
      // Valider chaque horaire
      for (const hour of hours) {
        if (hour.isOpen) {
          if (!hour.open || !hour.close) {
            throw new Error(`Les heures d'ouverture et de fermeture sont requises pour ${hour.day}`);
          }
          
          // Vérifier le format des heures (HH:MM)
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(hour.open) || !timeRegex.test(hour.close)) {
            throw new Error(`Format d'heure invalide pour ${hour.day}. Utilisez HH:MM`);
          }
          
          // Vérifier que l'heure de fermeture est après l'heure d'ouverture
          const openTime = new Date(`2000-01-01 ${hour.open}`);
          const closeTime = new Date(`2000-01-01 ${hour.close}`);
          if (closeTime <= openTime) {
            throw new Error(`L'heure de fermeture doit être après l'heure d'ouverture pour ${hour.day}`);
          }
        }
      }
      
      return true;
    })
];

// Validation pour les zones de livraison
const validateDeliveryZone = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom de la zone doit contenir entre 2 et 100 caractères')
    .custom((value) => {
      // Vérifier que le nom ne contient que des caractères autorisés
      const allowedPattern = /^[a-zA-ZÀ-ÿ0-9\s\-'.,()]+$/;
      if (!allowedPattern.test(value)) {
        throw new Error('Le nom de la zone contient des caractères non autorisés');
      }
      return true;
    }),
    
  body('deliveryFee')
    .isInt({ min: 0, max: 10000 })
    .withMessage('Les frais de livraison doivent être entre 0 et 10,000 FCFA'),
    
  body('minOrder')
    .isInt({ min: 500, max: 100000 })
    .withMessage('La commande minimum doit être entre 500 et 100,000 FCFA'),
    
  body('estimatedDeliveryTime')
    .optional()
    .isInt({ min: 15, max: 480 })
    .withMessage('Le temps de livraison estimé doit être entre 15 minutes et 8 heures'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La description ne peut pas dépasser 500 caractères')
];

// Middleware pour traiter les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Données de validation invalides', errorMessages));
  }
  
  next();
};

// Validation des données sensibles (pour éviter les injections)
const sanitizeInput = (req, res, next) => {
  const sensitiveFields = ['businessName', 'description', 'address', 'nomCommerce'];
  
  for (const field of sensitiveFields) {
    if (req.body[field] && typeof req.body[field] === 'string') {
      // Supprimer les balises HTML et scripts potentiellement dangereux
      req.body[field] = req.body[field]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
  }
  
  next();
};

// Validation des coordonnées GPS pour s'assurer qu'elles sont en Côte d'Ivoire
const validateCoordinates = (lat, lng) => {
  // Limites approximatives de la Côte d'Ivoire
  const CI_BOUNDS = {
    north: 10.74,
    south: 4.36,
    east: -2.49,
    west: -8.60
  };
  
  if (lat < CI_BOUNDS.south || lat > CI_BOUNDS.north) {
    throw new Error('La latitude doit être située en Côte d\'Ivoire');
  }
  
  if (lng < CI_BOUNDS.west || lng > CI_BOUNDS.east) {
    throw new Error('La longitude doit être située en Côte d\'Ivoire');
  }
  
  return true;
};

// Validation spécifique pour Abidjan
const validateAbidjanCoordinates = (lat, lng) => {
  // Limites approximatives d'Abidjan
  const ABIDJAN_BOUNDS = {
    north: 5.45,
    south: 5.25,
    east: -3.85,
    west: -4.15
  };
  
  if (lat < ABIDJAN_BOUNDS.south || lat > ABIDJAN_BOUNDS.north ||
      lng < ABIDJAN_BOUNDS.west || lng > ABIDJAN_BOUNDS.east) {
    throw new Error('Les coordonnées doivent être situées dans la région d\'Abidjan');
  }
  
  return true;
};

module.exports = {
  validatePressingRegistration,
  validatePressingProfileUpdate,
  validateDeliveryZone,
  handleValidationErrors,
  sanitizeInput,
  validateCoordinates,
  validateAbidjanCoordinates
};
