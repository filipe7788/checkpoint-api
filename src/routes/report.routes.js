const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validator');

/**
 * @route   POST /reports
 * @desc    Create a new report
 * @access  Private
 */
router.post('/', authenticate, validate(schemas.createReport), reportController.createReport);

/**
 * @route   GET /reports
 * @desc    Get all reports (admin only in the future)
 * @access  Private
 */
router.get('/', authenticate, reportController.getReports);

/**
 * @route   GET /reports/:id
 * @desc    Get report by ID
 * @access  Private
 */
router.get('/:id', authenticate, reportController.getReport);

module.exports = router;
