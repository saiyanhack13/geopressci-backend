/**
 * Classe pour gérer les erreurs de l'API
 * @extends Error
 */
class ApiError extends Error {
  /**
   * Crée une instance de ApiError
   * @param {number} statusCode - Code de statut HTTP
   * @param {string} message - Message d'erreur (par défaut: 'Something went wrong')
   * @param {Array} errors - Tableau d'erreurs (optionnel)
   * @param {string} stack - Pile d'appels (optionnel)
   */
  constructor(
    statusCode,
    message = 'Something went wrong',
    errors = [],
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
