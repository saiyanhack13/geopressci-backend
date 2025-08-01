const logger = require('../../utils/logger');

// Mock du service d'email pour l'environnement de test
const emailServiceMock = {
  sendEmail: jest.fn().mockImplementation(({ to, subject }) => {
    logger.info(`[Test Mock] sendEmail called for: ${to} with subject: ${subject}`);
    return Promise.resolve({ success: true, messageId: 'mock-email-id' });
  }),

  sendPasswordResetEmail: jest.fn().mockImplementation((to, resetToken) => {
    logger.info(`[Test Mock] sendPasswordResetEmail called for: ${to} with token: ${resetToken}`);
    return Promise.resolve({ success: true, messageId: 'mock-reset-email-id' });
  }),

  sendVerificationEmail: jest.fn().mockImplementation((to, verificationToken) => {
    logger.info(`[Test Mock] sendVerificationEmail called for: ${to} with token: ${verificationToken}`);
    return Promise.resolve({ success: true, messageId: 'mock-verify-email-id' });
  }),
};

module.exports = emailServiceMock;
