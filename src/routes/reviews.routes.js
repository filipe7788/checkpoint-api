const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validator');
const { createLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /reviews
 * @desc    Create a review
 * @access  Private
 */
router.post('/', authenticate, createLimiter, validate(schemas.createReview), reviewController.create);

/**
 * @route   PUT /reviews/:id
 * @desc    Update a review
 * @access  Private
 */
router.put('/:id', authenticate, validate(schemas.updateReview), reviewController.update);

/**
 * @route   DELETE /reviews/:id
 * @desc    Delete a review
 * @access  Private
 */
router.delete('/:id', authenticate, reviewController.delete);

/**
 * @route   GET /reviews/game/:gameId
 * @desc    Get reviews for a game
 * @access  Public
 */
router.get('/game/:gameId', reviewController.getByGame);

/**
 * @route   GET /reviews/user/:userId
 * @desc    Get reviews by a user
 * @access  Public
 */
router.get('/user/:userId', reviewController.getByUser);

/**
 * @route   POST /reviews/:id/like
 * @desc    Like a review
 * @access  Private
 */
router.post('/:id/like', authenticate, reviewController.like);

/**
 * @route   DELETE /reviews/:id/like
 * @desc    Unlike a review
 * @access  Private
 */
router.delete('/:id/like', authenticate, reviewController.unlike);

module.exports = router;
