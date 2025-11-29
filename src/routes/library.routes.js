const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/library.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validator');
const { createLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /library
 * @desc    Add game to library
 * @access  Private
 */
router.post('/', authenticate, createLimiter, validate(schemas.addToLibrary), libraryController.add);

/**
 * @route   GET /library
 * @desc    Get user's library
 * @access  Private
 */
router.get('/', authenticate, validate(schemas.libraryFilter, 'query'), libraryController.getAll);

/**
 * @route   GET /library/:id
 * @desc    Get specific game from library
 * @access  Private
 */
router.get('/:id', authenticate, libraryController.getOne);

/**
 * @route   PUT /library/:id
 * @desc    Update library item
 * @access  Private
 */
router.put('/:id', authenticate, validate(schemas.updateLibraryItem), libraryController.update);

/**
 * @route   DELETE /library/:id
 * @desc    Remove game from library
 * @access  Private
 */
router.delete('/:id', authenticate, libraryController.remove);

module.exports = router;
