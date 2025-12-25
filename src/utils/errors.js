class AppError extends Error {
  constructor(errorCode, statusCode = 500, metadata = null) {
    super(errorCode);
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(errorCode, metadata = null) {
    super(errorCode, 400, metadata);
  }
}

class UnauthorizedError extends AppError {
  constructor(errorCode, metadata = null) {
    super(errorCode, 401, metadata);
  }
}

class ForbiddenError extends AppError {
  constructor(errorCode, metadata = null) {
    super(errorCode, 403, metadata);
  }
}

class NotFoundError extends AppError {
  constructor(errorCode, metadata = null) {
    super(errorCode, 404, metadata);
  }
}

class ConflictError extends AppError {
  constructor(errorCode, metadata = null) {
    super(errorCode, 409, metadata);
  }
}

class ValidationError extends AppError {
  constructor(errorCode, metadata = null) {
    super(errorCode, 400, metadata);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
};
