const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * @route   GET /feed
 * @desc    Get activity feed from followed users
 * @access  Private
 */
router.get('/', authenticate, activityController.getFeed);

/**
 * @route   GET /feed/now-playing
 * @desc    Get currently playing games from followed users
 * @access  Private
 */
router.get('/now-playing', authenticate, activityController.getNowPlaying);

module.exports = router;
