/**
 * Email Verification Utilities
 * Handles token generation and verification for email confirmation
 */

import crypto from 'crypto';

// In-memory token store for demo (use Redis/database in production)
const verificationTokens = new Map();
const resetTokens = new Map();

// Check if email verification is required
export const isVerificationRequired = () => {
  return process.env.EMAIL_VERIFICATION_REQUIRED === 'true';
};

/**
 * Generate a secure verification token
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} Verification token
 */
export const generateVerificationToken = (userId, email) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + (parseInt(process.env.VERIFICATION_TOKEN_EXPIRES_HOURS, 10) || 24) * 60 * 60 * 1000
  );

  verificationTokens.set(token, {
    userId,
    email,
    expiresAt,
    createdAt: new Date(),
  });

  return token;
};

/**
 * Verify an email verification token
 * @param {string} token - Verification token
 * @returns {Object|null} Token data if valid, null if invalid/expired
 */
export const verifyEmailToken = (token) => {
  const tokenData = verificationTokens.get(token);

  if (!tokenData) {
    return null;
  }

  if (new Date() > tokenData.expiresAt) {
    verificationTokens.delete(token);
    return null;
  }

  // Token is valid - remove it (one-time use)
  verificationTokens.delete(token);
  return tokenData;
};

/**
 * Generate a password reset token
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} Reset token
 */
export const generateResetToken = (userId, email) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  resetTokens.set(token, {
    userId,
    email,
    expiresAt,
    createdAt: new Date(),
  });

  return token;
};

/**
 * Verify a password reset token
 * @param {string} token - Reset token
 * @returns {Object|null} Token data if valid, null if invalid/expired
 */
export const verifyResetToken = (token) => {
  const tokenData = resetTokens.get(token);

  if (!tokenData) {
    return null;
  }

  if (new Date() > tokenData.expiresAt) {
    resetTokens.delete(token);
    return null;
  }

  return tokenData;
};

/**
 * Invalidate a reset token after use
 * @param {string} token - Reset token
 */
export const invalidateResetToken = (token) => {
  resetTokens.delete(token);
};

/**
 * Clean up expired tokens (call periodically)
 */
export const cleanupExpiredTokens = () => {
  const now = new Date();

  for (const [token, data] of verificationTokens) {
    if (now > data.expiresAt) {
      verificationTokens.delete(token);
    }
  }

  for (const [token, data] of resetTokens) {
    if (now > data.expiresAt) {
      resetTokens.delete(token);
    }
  }
};

/**
 * Generate email verification URL
 * @param {string} token - Verification token
 * @returns {string} Full verification URL
 */
export const getVerificationUrl = (token) => {
  return `${process.env.APP_URL}/auth/verify-email?token=${token}`;
};

/**
 * Generate password reset URL
 * @param {string} token - Reset token
 * @returns {string} Full reset URL
 */
export const getResetUrl = (token) => {
  return `${process.env.APP_URL}/auth/reset-password?token=${token}`;
};

export default {
  isVerificationRequired,
  generateVerificationToken,
  verifyEmailToken,
  generateResetToken,
  verifyResetToken,
  invalidateResetToken,
  cleanupExpiredTokens,
  getVerificationUrl,
  getResetUrl,
};

