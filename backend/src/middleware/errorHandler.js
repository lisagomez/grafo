/**
 * Error Handling Middleware
 */

import { config } from '../config/index.js';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common HTTP errors
 */
export const HttpErrors = {
  badRequest: (message = 'Bad request', errors = null) => 
    new ApiError(message, 400, errors),
  
  unauthorized: (message = 'Unauthorized') => 
    new ApiError(message, 401),
  
  forbidden: (message = 'Forbidden') => 
    new ApiError(message, 403),
  
  notFound: (message = 'Resource not found') => 
    new ApiError(message, 404),
  
  conflict: (message = 'Resource already exists') => 
    new ApiError(message, 409),
  
  tooManyRequests: (message = 'Too many requests') => 
    new ApiError(message, 429),
  
  internal: (message = 'Internal server error') => 
    new ApiError(message, 500),
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  next(HttpErrors.notFound(`Route ${req.originalUrl} not found`));
};

/**
 * Global Error Handler
 */
export const errorHandler = (err, req, res, next) => {
  // Log error
  console.error('Error:', {
    message: err.message,
    stack: config.env === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  });

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Handle Prisma errors
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'A record with this value already exists';
  }

  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  }

  // Build response
  const response = {
    success: false,
    error: {
      message,
      ...(errors && { errors }),
      ...(config.env === 'development' && { stack: err.stack }),
    },
  };

  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default {
  ApiError,
  HttpErrors,
  notFoundHandler,
  errorHandler,
  asyncHandler,
};

