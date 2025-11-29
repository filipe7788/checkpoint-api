const rateLimit = require('express-rate-limit');

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for sync operations
const syncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 syncs per hour
  message: {
    success: false,
    error: 'Too many sync requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for creating content (reviews, etc)
const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 creates per minute
  message: {
    success: false,
    error: 'Too many requests, please slow down',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  syncLimiter,
  createLimiter,
};
