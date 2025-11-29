const express = require('express');
const router = express.Router();
const followController = require('../controllers/follow.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * @route   POST /follow/:id
 * @desc    Follow a user
 * @access  Private
 */
router.post('/:id', authenticate, followController.follow);

/**
 * @route   DELETE /follow/:id
 * @desc    Unfollow a user
 * @access  Private
 */
router.delete('/:id', authenticate, followController.unfollow);

/**
 * @route   GET /follow/:id/check
 * @desc    Check if following a user
 * @access  Private
 */
router.get('/:id/check', authenticate, followController.checkFollowing);

module.exports = router;
