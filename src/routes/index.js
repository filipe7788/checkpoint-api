const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const gameRoutes = require('./game.routes');
const libraryRoutes = require('./library.routes');
const reviewRoutes = require('./reviews.routes');
const followRoutes = require('./follow.routes');
const activityRoutes = require('./activity.routes');
const syncRoutes = require('./sync.routes');
const oauthRoutes = require('./oauth.routes');
const reportRoutes = require('./report.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/games', gameRoutes);
router.use('/library', libraryRoutes);
router.use('/reviews', reviewRoutes);
router.use('/follow', followRoutes);
router.use('/feed', activityRoutes);
router.use('/sync', syncRoutes);
router.use('/oauth', oauthRoutes);
router.use('/reports', reportRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'CheckPoint API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
