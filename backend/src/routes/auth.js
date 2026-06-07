/**
 * Authentication Routes
 * Supports both simple auth and email verification flows
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { asyncHandler, HttpErrors } from '../middleware/errorHandler.js';
import { authenticate, generateTokens } from '../middleware/auth.js';

const router = Router();

// Check if email verification is required from environment
const isVerificationRequired = () => process.env.EMAIL_VERIFICATION_REQUIRED === 'true';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// In-memory stores for demo (replace with database in production)
const users = new Map();
const verificationTokens = new Map();
const resetTokens = new Map();

/**
 * Generate a secure token
 */
const generateToken = () => crypto.randomBytes(32).toString('hex');

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', asyncHandler(async (req, res) => {
  // Validate input
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    throw HttpErrors.badRequest('Validation failed', result.error.errors);
  }

  const { email, password, name } = result.data;

  // Check if user exists
  if (users.has(email)) {
    throw HttpErrors.conflict('User already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = {
    id: `user_${Date.now()}`,
    email,
    name,
    password: hashedPassword,
    role: 'user',
    emailVerified: !isVerificationRequired(), // Auto-verified if not required
    createdAt: new Date(),
  };

  users.set(email, user);

  // If email verification is required, send verification email
  if (isVerificationRequired()) {
    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    verificationTokens.set(verificationToken, {
      userId: user.id,
      email: user.email,
      expiresAt,
    });

    // In production, send email with verification link
    console.log(`📧 Verification email would be sent to ${email}`);
    console.log(`   Token: ${verificationToken}`);
    console.log(`   Link: ${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`);

    // Return success without tokens (user must verify first)
    const { password: _, ...userWithoutPassword } = user;
    
    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: userWithoutPassword,
        requiresVerification: true,
      },
    });
  }

  // No verification required - generate tokens and login immediately
  const tokens = generateTokens(user);
  const { password: _, ...userWithoutPassword } = user;

  res.status(201).json({
    success: true,
    data: {
      user: userWithoutPassword,
      ...tokens,
    },
  });
}));

/**
 * POST /auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw HttpErrors.badRequest('Verification token required');
  }

  const tokenData = verificationTokens.get(token);

  if (!tokenData) {
    throw HttpErrors.badRequest('Invalid or expired verification token');
  }

  if (new Date() > tokenData.expiresAt) {
    verificationTokens.delete(token);
    throw HttpErrors.badRequest('Verification token has expired');
  }

  // Find and update user
  const user = users.get(tokenData.email);
  if (!user) {
    throw HttpErrors.notFound('User not found');
  }

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  users.set(tokenData.email, user);

  // Remove used token
  verificationTokens.delete(token);

  // Generate auth tokens
  const tokens = generateTokens(user);
  const { password: _, ...userWithoutPassword } = user;

  res.json({
    success: true,
    message: 'Email verified successfully',
    data: {
      user: userWithoutPassword,
      ...tokens,
    },
  });
}));

/**
 * POST /auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw HttpErrors.badRequest('Email required');
  }

  const user = users.get(email);

  // For security, don't reveal if user exists
  if (!user || user.emailVerified) {
    return res.json({
      success: true,
      message: 'If an unverified account exists with this email, a new verification link will be sent.',
    });
  }

  // Remove any existing verification tokens for this user
  for (const [token, data] of verificationTokens) {
    if (data.email === email) {
      verificationTokens.delete(token);
    }
  }

  // Generate new token
  const verificationToken = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  verificationTokens.set(verificationToken, {
    userId: user.id,
    email: user.email,
    expiresAt,
  });

  // In production, send email
  console.log(`📧 New verification email would be sent to ${email}`);
  console.log(`   Token: ${verificationToken}`);

  res.json({
    success: true,
    message: 'If an unverified account exists with this email, a new verification link will be sent.',
  });
}));

/**
 * POST /auth/login
 * Login a user
 */
router.post('/login', asyncHandler(async (req, res) => {
  // Validate input
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    throw HttpErrors.badRequest('Validation failed', result.error.errors);
  }

  const { email, password } = result.data;

  // Find user
  const user = users.get(email);
  if (!user) {
    throw HttpErrors.unauthorized('Invalid credentials');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw HttpErrors.unauthorized('Invalid credentials');
  }

  // Check if email verification is required and not verified
  if (isVerificationRequired() && !user.emailVerified) {
    throw HttpErrors.forbidden('Please verify your email before logging in');
  }

  // Generate tokens
  const tokens = generateTokens(user);

  // Return user (without password) and tokens
  const { password: _, ...userWithoutPassword } = user;

  res.json({
    success: true,
    data: {
      user: userWithoutPassword,
      ...tokens,
    },
  });
}));

/**
 * POST /auth/logout
 * Logout a user
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // In production, invalidate the token in Redis/database
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}));

/**
 * GET /auth/me
 * Get current user
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  // Find user by ID from token
  let foundUser = null;
  for (const user of users.values()) {
    if (user.id === req.user.id) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser) {
    throw HttpErrors.notFound('User not found');
  }

  const { password: _, ...userWithoutPassword } = foundUser;

  res.json({
    success: true,
    data: userWithoutPassword,
  });
}));

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw HttpErrors.badRequest('Refresh token required');
  }

  // Verify refresh token and generate new tokens
  // In production, validate against stored refresh tokens
  
  res.json({
    success: true,
    data: {
      message: 'Token refresh placeholder',
    },
  });
}));

/**
 * POST /auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw HttpErrors.badRequest('Email required');
  }

  const user = users.get(email);

  // Always return success for security (don't reveal if email exists)
  if (user) {
    // Remove any existing reset tokens for this user
    for (const [token, data] of resetTokens) {
      if (data.email === email) {
        resetTokens.delete(token);
      }
    }

    // Generate reset token
    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    resetTokens.set(resetToken, {
      userId: user.id,
      email: user.email,
      expiresAt,
    });

    // In production, send password reset email
    console.log(`📧 Password reset email would be sent to ${email}`);
    console.log(`   Token: ${resetToken}`);
    console.log(`   Link: ${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`);
  }

  res.json({
    success: true,
    message: 'If an account exists with this email, you will receive a password reset link',
  });
}));

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    throw HttpErrors.badRequest('Token and password required');
  }

  if (password.length < 8) {
    throw HttpErrors.badRequest('Password must be at least 8 characters');
  }

  const tokenData = resetTokens.get(token);

  if (!tokenData) {
    throw HttpErrors.badRequest('Invalid or expired reset token');
  }

  if (new Date() > tokenData.expiresAt) {
    resetTokens.delete(token);
    throw HttpErrors.badRequest('Reset token has expired');
  }

  // Find and update user
  const user = users.get(tokenData.email);
  if (!user) {
    throw HttpErrors.notFound('User not found');
  }

  // Update password
  user.password = await bcrypt.hash(password, 12);
  user.passwordChangedAt = new Date();
  users.set(tokenData.email, user);

  // Remove used token
  resetTokens.delete(token);

  res.json({
    success: true,
    message: 'Password reset successfully. You can now login with your new password.',
  });
}));

/**
 * GET /auth/verification-status
 * Check if email verification is required
 */
router.get('/verification-status', (req, res) => {
  res.json({
    success: true,
    data: {
      emailVerificationRequired: isVerificationRequired(),
    },
  });
});

export default router;
