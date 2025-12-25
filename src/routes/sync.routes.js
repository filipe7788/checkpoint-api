const express = require('express');
const router = express.Router();
const syncController = require('../controllers/sync.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { syncLimiter } = require('../middleware/rateLimiter');

/**
 * @route   GET /sync/status
 * @desc    Get sync status for all platforms
 * @access  Private
 */
router.get('/status', authenticate, syncController.getStatus);

/**
 * @route   GET /sync/mappings
 * @desc    Get all game title mappings (optionally filtered by platform)
 * @access  Private
 * @query   platform (optional)
 */
router.get('/mappings', authenticate, syncController.getMappings);

/**
 * @route   POST /sync/mappings
 * @desc    Create a new game title mapping
 * @access  Private
 * @body    { platform, originalTitle, gameId }
 */
router.post(
  '/mappings',
  (req, res, next) => {
    next();
  },
  authenticate,
  (req, res, next) => {
    next();
  },
  syncController.createMapping
);

/**
 * @route   DELETE /sync/mappings
 * @desc    Delete a game title mapping
 * @access  Private
 * @body    { platform, originalTitle }
 */
router.delete('/mappings', authenticate, syncController.deleteMapping);

/**
 * @route   POST /sync/:platform
 * @desc    Connect platform with manual credentials
 * @access  Private
 * @body    Xbox: { gamertag }
 *          PSN: { npsso, accountId }
 * @note    Steam uses OAuth - redirect to /api/oauth/steam instead
 */
router.post('/:platform', authenticate, syncController.connectManual);

/**
 * @route   DELETE /sync/disconnect/:platform
 * @desc    Disconnect a platform
 * @access  Private
 */
router.delete('/disconnect/:platform', authenticate, syncController.disconnect);

/**
 * @route   POST /sync/:platform/sync
 * @desc    Sync games from a platform
 * @access  Private
 */
router.post('/:platform/sync', authenticate, syncLimiter, syncController.sync);

/**
 * @route   GET /sync/:platform/progress
 * @desc    Stream sync progress updates (SSE)
 * @access  Private
 */
router.get('/:platform/progress', authenticate, syncController.streamProgress);

/**
 * @route   POST /sync/all
 * @desc    Sync all connected platforms
 * @access  Private
 */
router.post('/all', authenticate, syncLimiter, syncController.syncAll);

/**
 * @route   GET /sync/xbox/quota
 * @desc    Get Xbox API quota information
 * @access  Private
 * @status  TODO - Not implemented (OpenXBL doesn't provide quota info)
 */
// router.get('/xbox/quota', authenticate, syncController.getXboxQuota);

module.exports = router;
