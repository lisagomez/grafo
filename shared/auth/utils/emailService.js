/**
 * Email Service
 * Handles sending transactional emails for authentication
 */

import nodemailer from 'nodemailer';

// Email configuration from environment
const emailConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
};

// Create transporter (only if SMTP is configured)
let transporter = null;
if (emailConfig.host && emailConfig.auth.user) {
  transporter = nodemailer.createTransport(emailConfig);
}

/**
 * Check if email service is configured
 */
export const isEmailConfigured = () => {
  return transporter !== null;
};

/**
 * Send verification email
 * @param {string} to - Recipient email
 * @param {string} token - Verification token
 * @param {string} name - User's name
 */
export const sendVerificationEmail = async (to, token, name = 'User') => {
  if (!transporter) {
    console.log('📧 Email not configured. Verification token:', token);
    return { success: true, mock: true };
  }

  const verificationUrl = `${process.env.APP_URL}/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: `"${process.env.FROM_NAME || 'SaaS App'}" <${process.env.FROM_EMAIL}>`,
    to,
    subject: 'Verify your email address',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { width: 50px; height: 50px; background: linear-gradient(135deg, #0ea5e9, #d946ef); border-radius: 12px; margin: 0 auto 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #0284c7; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
    .link { color: #0ea5e9; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"></div>
      <h1 style="margin: 0; color: #111;">Verify your email</h1>
    </div>
    
    <p>Hi ${name},</p>
    
    <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
    
    <div style="text-align: center;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${verificationUrl}" class="link">${verificationUrl}</a>
    </p>
    
    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in ${process.env.VERIFICATION_TOKEN_EXPIRES_HOURS || 24} hours.
    </p>
    
    <div class="footer">
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>&copy; ${new Date().getFullYear()} SaaS App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
Hi ${name},

Thanks for signing up! Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in ${process.env.VERIFICATION_TOKEN_EXPIRES_HOURS || 24} hours.

If you didn't create an account, you can safely ignore this email.
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} token - Reset token
 * @param {string} name - User's name
 */
export const sendPasswordResetEmail = async (to, token, name = 'User') => {
  if (!transporter) {
    console.log('📧 Email not configured. Reset token:', token);
    return { success: true, mock: true };
  }

  const resetUrl = `${process.env.APP_URL}/auth/reset-password?token=${token}`;

  const mailOptions = {
    from: `"${process.env.FROM_NAME || 'SaaS App'}" <${process.env.FROM_EMAIL}>`,
    to,
    subject: 'Reset your password',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { width: 50px; height: 50px; background: linear-gradient(135deg, #0ea5e9, #d946ef); border-radius: 12px; margin: 0 auto 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
    .link { color: #0ea5e9; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"></div>
      <h1 style="margin: 0; color: #111;">Reset your password</h1>
    </div>
    
    <p>Hi ${name},</p>
    
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    
    <div style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" class="link">${resetUrl}</a>
    </p>
    
    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in 1 hour.
    </p>
    
    <div class="footer">
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>&copy; ${new Date().getFullYear()} SaaS App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
Hi ${name},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email after verification
 * @param {string} to - Recipient email
 * @param {string} name - User's name
 */
export const sendWelcomeEmail = async (to, name = 'User') => {
  if (!transporter) {
    console.log('📧 Email not configured. Would send welcome email to:', to);
    return { success: true, mock: true };
  }

  const mailOptions = {
    from: `"${process.env.FROM_NAME || 'SaaS App'}" <${process.env.FROM_EMAIL}>`,
    to,
    subject: 'Welcome to SaaS App! 🎉',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { width: 50px; height: 50px; background: linear-gradient(135deg, #0ea5e9, #d946ef); border-radius: 12px; margin: 0 auto 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"></div>
      <h1 style="margin: 0; color: #111;">Welcome aboard! 🎉</h1>
    </div>
    
    <p>Hi ${name},</p>
    
    <p>Your email has been verified and your account is now active. You're all set to start using SaaS App!</p>
    
    <div style="text-align: center;">
      <a href="${process.env.APP_URL}/dashboard" class="button">Go to Dashboard</a>
    </div>
    
    <p>Here are a few things you can do to get started:</p>
    <ul>
      <li>Complete your profile</li>
      <li>Create your first workspace</li>
      <li>Invite team members</li>
    </ul>
    
    <div class="footer">
      <p>Need help? Reply to this email and we'll be happy to assist.</p>
      <p>&copy; ${new Date().getFullYear()} SaaS App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
};

export default {
  isEmailConfigured,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};

