const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');
const prisma = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError(ErrorCode.AUTH_NO_TOKEN_PROVIDED);
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user still exists and is not banned
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isBanned: true,
          banReason: true,
        },
      });

      if (!user) {
        throw new UnauthorizedError(ErrorCode.AUTH_USER_NOT_FOUND);
      }

      if (user.isBanned) {
        throw new ForbiddenError(ErrorCode.AUTH_ACCOUNT_BANNED, { reason: user.banReason });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError(ErrorCode.AUTH_INVALID_TOKEN);
      }
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError(ErrorCode.AUTH_TOKEN_EXPIRED);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

// Optional auth - doesn't fail if no token
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isBanned: true,
        },
      });

      if (user && !user.isBanned) {
        req.user = user;
      }
    } catch {
      // Silently fail for optional auth
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticate,
  optionalAuth,
};
