const Pressing = require('../models/pressing.model');
const { ErrorResponse, ForbiddenError } = require('../utils/error.utils');

/**
 * Middleware pour vérifier si le pressing a un abonnement actif
 * Bloque l'accès si le pressing n'a pas d'abonnement actif
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const pressingId = req.user.id;
    
    // Trouver le pressing
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return next(new ErrorResponse('Pressing non trouvé', 404));
    }
    
    // Vérifier si le compte est actif (période d'essai ou abonnement payant)
    const isActive = pressing.isAccountActive();
    
    if (!isActive) {
      return next(new ForbiddenError(
        'Abonnement requis',
        'Votre période d\'essai est terminée. Veuillez souscrire à un abonnement pour continuer à utiliser nos services.',
        {
          subscriptionStatus: pressing.getSubscriptionStatus(),
          verificationStatus: pressing.verificationStatus,
          requiredAction: 'subscribe',
        }
      ));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware pour vérifier si le pressing a soumis sa vérification d'identité
 * Bloque l'accès si la vérification d'identité n'est pas soumise ou approuvée
 */
const requireIdentityVerification = async (req, res, next) => {
  try {
    const pressingId = req.user.id;
    
    // Trouver le pressing
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return next(new ErrorResponse('Pressing non trouvé', 404));
    }
    
    // Vérifier si la vérification d'identité est approuvée
    if (pressing.verificationStatus !== 'approuve') {
      return next(new ForbiddenError(
        'Vérification d\'identité requise',
        'Vous devez vérifier votre identité pour accéder à cette fonctionnalité.',
        {
          verificationStatus: pressing.verificationStatus,
          requiredAction: 'verify_identity',
          hasDocuments: pressing.verificationDocuments && pressing.verificationDocuments.length > 0,
        }
      ));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireActiveSubscription,
  requireIdentityVerification,
};
