const { AppError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');
const { Prisma } = require('@prisma/client');

function errorHandler(err, req, res, _next) {
  // Log error for debugging
  console.error('[ERROR]', {
    errorCode: err.errorCode || err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  // Operational errors (expected)
  if (err instanceof AppError) {
    const response = {
      success: false,
      errorCode: err.errorCode,
    };

    // Include metadata if present
    if (err.metadata) {
      response.metadata = err.metadata;
    }

    // Include message in development for debugging
    if (process.env.NODE_ENV === 'development') {
      response.debugMessage = err.message;
    }

    return res.status(err.statusCode).json(response);
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'field';
      return res.status(409).json({
        success: false,
        errorCode: ErrorCode.DB_UNIQUE_CONSTRAINT,
        metadata: { field },
      });
    }

    // Record not found
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        errorCode: ErrorCode.DB_RECORD_NOT_FOUND,
      });
    }

    // Foreign key constraint
    if (err.code === 'P2003') {
      return res.status(400).json({
        success: false,
        errorCode: ErrorCode.DB_FOREIGN_KEY_CONSTRAINT,
      });
    }
  }

  // Validation errors (Joi)
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      errorCode: ErrorCode.VALIDATION_ERROR,
      metadata: {
        details: err.details ? err.details[0].message : err.message,
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      errorCode: ErrorCode.AUTH_INVALID_TOKEN,
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      errorCode: ErrorCode.AUTH_TOKEN_EXPIRED,
    });
  }

  // Unexpected errors
  return res.status(500).json({
    success: false,
    errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
    ...(process.env.NODE_ENV === 'development' && {
      debugMessage: err.message,
    }),
  });
}

// 404 handler
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    errorCode: ErrorCode.ENDPOINT_NOT_FOUND,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
