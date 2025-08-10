/**
 * Classe de base pour les erreurs personnalisées
 */
class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode || 500;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erreur 404 - Ressource non trouvée
 */
class NotFoundError extends ErrorResponse {
  constructor(message = 'Ressource non trouvée') {
    super(message, 404);
  }
}

/**
 * Erreur 400 - Requête invalide
 */
class BadRequestError extends ErrorResponse {
  constructor(message = 'Requête invalide') {
    super(message, 400);
  }
}

/**
 * Erreur 401 - Non autorisé
 */
class UnauthorizedError extends ErrorResponse {
  constructor(message = 'Non autorisé') {
    super(message, 401);
  }
}

/**
 * Erreur 403 - Accès refusé
 */
class ForbiddenError extends ErrorResponse {
  constructor(message = 'Accès refusé') {
    super(message, 403);
  }
}

/**
 * Middleware de gestion des erreurs
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log de l'erreur en développement
  console.error(err.stack);

  // Erreur de validation Mongoose
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new BadRequestError(message);
  }

  // Erreur de clé dupliquée
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} est déjà utilisé`;
    error = new BadRequestError(message);
  }

  // Erreur de cast d'ObjectId
  if (err.name === 'CastError') {
    const message = `Ressource non trouvée avec l'ID ${err.value}`;
    error = new NotFoundError(message);
  }

  // Réponse d'erreur
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'Erreur serveur',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

module.exports = {
  ErrorResponse,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  errorHandler,
};
