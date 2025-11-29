const { AppError } = require('../utils/errors');
const { Prisma } = require('@prisma/client');

function errorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('[ERROR]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  // Operational errors (expected)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'field';
      return res.status(409).json({
        success: false,
        error: `${field} already exists`,
      });
    }

    // Record not found
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
    }

    // Foreign key constraint
    if (err.code === 'P2003') {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference',
      });
    }
  }

  // Validation errors (Joi)
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      error: err.details ? err.details[0].message : err.message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
    });
  }

  // Unexpected errors
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error',
  });
}

// 404 handler
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
