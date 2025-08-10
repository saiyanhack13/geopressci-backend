// Ce fichier est destiné à contenir la logique de communication avec les API de paiement externes (ex: CinetPay, Stripe).
// Pour l'instant, il contient des fonctions de simulation.

/**
 * Simule l'initiation d'un paiement Mobile Money.
 * @param {string} transactionId - L'ID de notre transaction interne.
 * @param {number} amount - Le montant à payer.
 * @param {string} phoneNumber - Le numéro de téléphone du client.
 * @returns {Promise<object>} - Une promesse qui résout avec les détails de la transaction du fournisseur.
 */
exports.initiateMobileMoneyPayment = async (transactionId, amount, phoneNumber) => {
  console.log(`[PaymentService] Appel de l'API externe pour initier le paiement de ${amount} XOF pour la transaction ${transactionId} sur le numéro ${phoneNumber}`);
  
  // Simulation d'un appel API
  await new Promise(resolve => setTimeout(resolve, 1500)); 

  const responseFromProvider = {
    providerTransactionId: `PP_${Date.now()}`,
    status: 'pending',
    message: 'Transaction initiated. Waiting for user validation.'
  };

  console.log(`[PaymentService] Réponse de l'API externe:`, responseFromProvider);
  return responseFromProvider;
};

/**
 * Simule la vérification du statut d'un paiement.
 * @param {string} transactionId - L'ID de notre transaction interne.
 * @returns {Promise<string>} - Une promesse qui résout avec le statut du paiement ('succeeded', 'failed', 'pending').
 */
exports.checkPaymentStatus = async (transactionId) => {
    console.log(`[PaymentService] Vérification du statut pour la transaction ${transactionId}`);

    // Simulation d'un appel API
    await new Promise(resolve => setTimeout(resolve, 1000));

    const possibleStatus = ['succeeded', 'failed', 'pending'];
    const status = possibleStatus[Math.floor(Math.random() * possibleStatus.length)];

    console.log(`[PaymentService] Statut obtenu de l'API externe: ${status}`);
    return status;
};
