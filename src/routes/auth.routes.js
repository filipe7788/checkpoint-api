const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validate, schemas } = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');

// Apply rate limiting to all auth routes
router.use(authLimiter);

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validate(schemas.register), authController.register);

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validate(schemas.login), authController.login);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', validate(schemas.refreshToken), authController.refreshToken);

/**
 * @route   POST /auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', validate(schemas.forgotPassword), authController.forgotPassword);

/**
 * @route   POST /auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', validate(schemas.resetPassword), authController.resetPassword);

module.exports = router;
