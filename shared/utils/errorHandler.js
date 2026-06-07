/**
 * Error Handler Utilities
 * Common error handling functions for API and frontend
 */

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
  }
}

/**
 * Common HTTP error factories
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
 * Extract error message from various error formats
 */
export const getErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  if (error?.errors?.[0]?.message) return error.errors[0].message;
  return 'An unexpected error occurred';
};

/**
 * Format validation errors for display
 */
export const formatValidationErrors = (errors) => {
  if (!errors) return {};
  
  if (Array.isArray(errors)) {
    return errors.reduce((acc, err) => {
      const field = err.path?.join('.') || err.field || 'unknown';
      acc[field] = err.message;
      return acc;
    }, {});
  }
  
  return errors;
};

/**
 * Check if error is a network error
 */
export const isNetworkError = (error) => {
  return (
    error.message === 'Network Error' ||
    error.message === 'Failed to fetch' ||
    error.code === 'ECONNREFUSED' ||
    !navigator?.onLine
  );
};

/**
 * Log error with context
 */
export const logError = (error, context = {}) => {
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString(),
  });
  
  // In production, send to error tracking service
  // Sentry.captureException(error, { extra: context });
};

export default {
  ApiError,
  HttpErrors,
  getErrorMessage,
  formatValidationErrors,
  isNetworkError,
  logError,
};

