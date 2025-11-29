const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validate, schemas } = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');
const passport = require('../config/passport');

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

/**
 * @route   GET /auth/google
 * @desc    Initiate Google OAuth login
 * @access  Public
 */
router.get('/google', passport.authenticate('google', {
  session: false,
  prompt: 'select_account'
}));

/**
 * @route   GET /auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/login/failed' }),
  authController.googleCallback
);

/**
 * @route   GET /auth/apple
 * @desc    Initiate Apple OAuth login
 * @access  Public
 */
router.get('/apple', passport.authenticate('apple', { session: false }));

/**
 * @route   GET /auth/apple/callback
 * @desc    Apple OAuth callback
 * @access  Public
 */
router.post(
  '/apple/callback',
  passport.authenticate('apple', { session: false, failureRedirect: '/auth/login/failed' }),
  authController.appleCallback
);

/**
 * @route   GET /auth/login/failed
 * @desc    OAuth login failed
 * @access  Public
 */
router.get('/login/failed', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'OAuth login failed',
  });
});

module.exports = router;
