/**
 * Middleware central de validation pour l'application GeoPressCI
 * Ce fichier sert de point d'entrée pour toutes les validations
 */

const { validate, validationResult } = require('./validators/auth.validator');

module.exports = {
  validate,
  validationResult
};
