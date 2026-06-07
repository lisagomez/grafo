/**
 * Authentication Middleware
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { HttpErrors, asyncHandler } from './errorHandler.js';

/**
 * Verify JWT token and attach user to request
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw HttpErrors.unauthorized('No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw HttpErrors.unauthorized('Token expired');
    }
    throw HttpErrors.unauthorized('Invalid token');
  }
});

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    // Ignore token errors for optional auth
  }

  next();
});

/**
 * Require specific roles
 */
export const requireRoles = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw HttpErrors.unauthorized('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw HttpErrors.forbidden('Insufficient permissions');
    }

    next();
  });
};

/**
 * Check if user is workspace member
 */
export const requireWorkspaceMember = asyncHandler(async (req, res, next) => {
  const { workspaceId } = req.params;
  
  if (!workspaceId) {
    throw HttpErrors.badRequest('Workspace ID required');
  }

  // In production, check database for membership
  // For now, we'll pass through
  req.workspaceId = workspaceId;
  next();
});

/**
 * Check if user is workspace admin
 */
export const requireWorkspaceAdmin = asyncHandler(async (req, res, next) => {
  const { workspaceId } = req.params;
  
  if (!workspaceId) {
    throw HttpErrors.badRequest('Workspace ID required');
  }

  // In production, check database for admin role
  // For now, we'll pass through
  req.workspaceId = workspaceId;
  next();
});

/**
 * Generate JWT tokens
 */
export const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

export default {
  authenticate,
  optionalAuth,
  requireRoles,
  requireWorkspaceMember,
  requireWorkspaceAdmin,
  generateTokens,
};

