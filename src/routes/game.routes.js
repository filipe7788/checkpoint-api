const express = require('express');
const router = express.Router();
const gameController = require('../controllers/game.controller');
const { validate, schemas } = require('../middleware/validator');

/**
 * @route   GET /games/search
 * @desc    Search games in IGDB
 * @access  Public
 */
router.get('/search', validate(schemas.gameSearch, 'query'), gameController.search);

/**
 * @route   GET /games/popular
 * @desc    Get popular games
 * @access  Public
 */
router.get('/popular', gameController.getPopular);

/**
 * @route   GET /games/genre/:genre
 * @desc    Get games by genre
 * @access  Public
 */
router.get('/genre/:genre', gameController.getByGenre);

/**
 * @route   GET /games/igdb/:igdbId
 * @desc    Get game by IGDB ID
 * @access  Public
 */
router.get('/igdb/:igdbId', gameController.getByIgdbId);

/**
 * @route   GET /games/:id
 * @desc    Get game by ID
 * @access  Public
 */
router.get('/:id', gameController.getById);

module.exports = router;
