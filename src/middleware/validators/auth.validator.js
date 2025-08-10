const { body, validationResult } = require('express-validator');

// Règles de validation communes
const commonRules = [
  body('email')
    .isEmail()
    .withMessage('Veuillez fournir un email valide')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères'),
];

// Règles de validation pour l'inscription d'un client
const registerClientRules = [
  ...commonRules,
  body('nom')
    .notEmpty()
    .withMessage('Le nom est requis')
    .trim()
    .escape(),
  body('prenom')
    .notEmpty()
    .withMessage('Le prénom est requis')
    .trim()
    .escape(),
  body('telephone')
    .notEmpty()
    .withMessage('Le numéro de téléphone est requis')
    .matches(/^[0-9+\s-]+$/)
    .withMessage('Numéro de téléphone invalide')
    .trim(),
  body('adresse')
    .notEmpty()
    .withMessage('L\'adresse est requise')
    .trim()
    .escape(),
];

// Règles de validation pour l'inscription d'un pressing
const registerPressingRules = [
  ...commonRules,
  body('nom')
    .notEmpty()
    .withMessage('Le nom est requis')
    .trim()
    .escape(),
  body('prenom')
    .notEmpty()
    .withMessage('Le prénom est requis')
    .trim()
    .escape(),
  body('telephone')
    .notEmpty()
    .withMessage('Le numéro de téléphone est requis')
    .matches(/^[0-9+\s-]+$/)
    .withMessage('Numéro de téléphone invalide')
    .trim(),
  body('nomCommerce')
    .notEmpty()
    .withMessage('Le nom du commerce est requis')
    .trim()
    .escape(),
  body('adresse')
    .notEmpty()
    .withMessage('L\'adresse est requise')
    .trim()
    .escape(),
  body('ville')
    .notEmpty()
    .withMessage('La ville est requise')
    .trim()
    .escape(),
  body('codePostal')
    .notEmpty()
    .withMessage('Le code postal est requis')
    .trim()
    .escape(),
  body('services')
    .optional({ checkFalsy: true })
    .isArray()
    .withMessage('Les services doivent être un tableau'),
  body('services.*.nom')
    .if(body('services').exists())
    .notEmpty()
    .withMessage('Le nom du service est requis')
    .trim()
    .escape(),
  body('services.*.prix')
    .if(body('services').exists())
    .isNumeric()
    .withMessage('Le prix doit être un nombre')
    .isFloat({ min: 0 })
    .withMessage('Le prix ne peut pas être négatif'),
];

// Règles de validation pour la connexion
const loginRules = [
  body('email')
    .isEmail()
    .withMessage('Veuillez fournir un email valide')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis'),
  body('userType')
    .notEmpty()
    .withMessage("Le type d'utilisateur est requis")
    .isIn(['client', 'pressing', 'admin'])
    .withMessage("Type d'utilisateur invalide"),
];

// Middleware de validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  
  // Format des erreurs plus détaillé pour le frontend
  const extractedErrors = [];
  const errorDetails = {};
  
  errors.array().forEach(err => {
    extractedErrors.push({ [err.param]: err.msg });
    errorDetails[err.param] = err.msg;
  });

  console.log('❌ Erreurs de validation:', errorDetails);

  return res.status(400).json({
    success: false,
    message: 'Données de validation invalides',
    errors: extractedErrors,
    details: errorDetails
  });
};

// Exporter les règles de validation
module.exports = {
  registerClientRules,
  registerPressingRules,
  loginRules,
  validate,
  validationResult
};
