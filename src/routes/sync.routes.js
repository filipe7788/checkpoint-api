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
 * @route   POST /sync/connect/:platform
 * @desc    Initiate platform connection (returns auth URL)
 * @access  Private
 */
router.post('/connect/:platform', authenticate, syncController.initiateConnection);

/**
 * @route   GET /sync/callback/:platform
 * @desc    OAuth callback for platform authentication
 * @access  Public (handles its own auth via state)
 */
router.get('/callback/:platform', syncController.handleCallback);

/**
 * @route   POST /sync/:platform
 * @desc    Manual platform connection (for PSN, etc)
 * @access  Private
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
 * @route   POST /sync/all
 * @desc    Sync all connected platforms
 * @access  Private
 */
router.post('/all', authenticate, syncLimiter, syncController.syncAll);

module.exports = router;
