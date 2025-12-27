const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validator');
const { upload } = require('../middleware/upload.middleware');

/**
 * @route   GET /users/search
 * @desc    Search users by username or email
 * @access  Public
 */
router.get('/search', userController.searchUsers);

/**
 * @route   GET /users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, userController.getMe);

/**
 * @route   PUT /users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', authenticate, validate(schemas.updateProfile), userController.updateMe);

/**
 * @route   POST /users/me/avatar
 * @desc    Upload user avatar
 * @access  Private
 */
router.post('/me/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);

/**
 * @route   GET /users/me/stats
 * @desc    Get current user statistics
 * @access  Private
 */
router.get('/me/stats', authenticate, userController.getMyStats);

/**
 * @route   GET /users/:username
 * @desc    Get user profile by username
 * @access  Public
 */
router.get('/:username', userController.getUserByUsername);

/**
 * @route   GET /users/:id/followers
 * @desc    Get user's followers
 * @access  Public
 */
router.get('/:id/followers', userController.getFollowers);

/**
 * @route   GET /users/:id/following
 * @desc    Get users that this user follows
 * @access  Public
 */
router.get('/:id/following', userController.getFollowing);

module.exports = router;
