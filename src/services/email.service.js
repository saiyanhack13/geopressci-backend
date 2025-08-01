const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../utils/logger');

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure, // true for 465, false for other ports
  auth: {
    user: config.email.user,
    pass: config.email.password
  },
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: false
  }
});

// Verify connection configuration - temporarily disabled to allow server startup
// transporter.verify(function(error, success) {
//   if (error) {
//     logger.error('Error verifying email transporter:', error);
//   } else {
//     logger.info('Email server is ready to take our messages');
//   }
// });

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text email body
 * @param {string} [options.html] - HTML email body (optional)
 * @returns {Promise<Object>} Result of the email sending operation
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const mailOptions = {
      from: `"${config.email.fromName}" <${config.email.fromAddress}>`,
      to,
      subject,
      text,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send a password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetToken - Password reset token
 * @returns {Promise<Object>} Result of the email sending operation
 */
const sendPasswordResetEmail = async (to, resetToken) => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
  const subject = 'Réinitialisation de votre mot de passe';
  const text = `Bonjour,\n\n` +
    `Vous avez demandé la réinitialisation de votre mot de passe. Veuillez cliquer sur le lien ci-dessous pour définir un nouveau mot de passe :\n\n` +
    `${resetUrl}\n\n` +
    `Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.\n\n` +
    `Cordialement,\nL'équipe ${config.appName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Réinitialisation de votre mot de passe</h2>
      <p>Bonjour,</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe. Veuillez cliquer sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
      <p><a href="${resetUrl}" style="color: #4CAF50; word-break: break-all;">${resetUrl}</a></p>
      <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.</p>
      <p>Cordialement,<br>L'équipe ${config.appName}</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};

/**
 * Send an account verification email
 * @param {string} to - Recipient email address
 * @param {string} verificationToken - Email verification token
 * @returns {Promise<Object>} Result of the email sending operation
 */
const sendVerificationEmail = async (to, verificationToken) => {
  const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
  const subject = 'Veuillez vérifier votre adresse email';
  const text = `Bonjour,\n\n` +
    `Merci de vous être inscrit sur ${config.appName}. Veuillez cliquer sur le lien ci-dessous pour vérifier votre adresse email :\n\n` +
    `${verificationUrl}\n\n` +
    `Si vous n'avez pas créé de compte, veuillez ignorer cet email.\n\n` +
    `Cordialement,\nL'équipe ${config.appName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Vérification de votre adresse email</h2>
      <p>Bonjour,</p>
      <p>Merci de vous être inscrit sur ${config.appName}. Veuillez cliquer sur le bouton ci-dessous pour vérifier votre adresse email :</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Vérifier mon email
        </a>
      </p>
      <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
      <p><a href="${verificationUrl}" style="color: #4CAF50; word-break: break-all;">${verificationUrl}</a></p>
      <p>Si vous n'avez pas créé de compte, veuillez ignorer cet email.</p>
      <p>Cordialement,<br>L'équipe ${config.appName}</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail
};
