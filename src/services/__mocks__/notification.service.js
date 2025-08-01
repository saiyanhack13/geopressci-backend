const logger = require('../../utils/logger');

// Mock du service de notification pour l'environnement de test

const notificationServiceMock = {
  sendEmail: jest.fn().mockImplementation((to, subject, html, text) => {
    logger.info(`[Test Mock] sendEmail called for: ${to}`);
    return Promise.resolve({ success: true, messageId: 'mock-message-id' });
  }),

  sendTemplatedEmail: jest.fn().mockImplementation((templateName, user, data = {}, customTo = null) => {
    const to = customTo || user.email;
    logger.info(`[Test Mock] sendTemplatedEmail '${templateName}' called for: ${to}`);
    return Promise.resolve({ success: true, messageId: 'mock-message-id' });
  }),

  sendSMS: jest.fn().mockImplementation((to, message) => {
    logger.info(`[Test Mock] sendSMS called for: ${to}`);
    return Promise.resolve({ success: true, sid: 'mock-sms-sid' });
  }),

  sendNotification: jest.fn().mockImplementation((user, { type = 'email', template, smsMessage, data = {} }) => {
    logger.info(`[Test Mock] sendNotification (type: ${type}, template: ${template}) called for: ${user.email || user.telephone}`);
    return Promise.resolve({ success: true, results: {} });
  }),
};

module.exports = notificationServiceMock;
