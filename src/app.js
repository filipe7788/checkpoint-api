require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required for Nginx reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  })
);

// Cookie parser - must be before routes
app.use(cookieParser());

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());

// Rate limiting
app.use(generalLimiter);

// Request logging in development
// Removed - use a proper logger instead if needed

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'CheckPoint API',
    version: '1.0.0',
    description: 'Backend API for game library management and social features',
    documentation: '/api/health',
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║       ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗██████╗      ║
║     ██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝██╔══██╗      ║
║     ██║     ███████║█████╗  ██║     █████╔╝ ██████╔╝      ║
║     ██║     ██╔══██║██╔══╝  ██║     ██╔═██╗ ██╔═══╝       ║
║     ╚██████╗██║  ██║███████╗╚██████╗██║  ██╗██║           ║
║      ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝           ║
║                                                           ║
║              Game Library & Social Platform               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

  🚀 Server running on port ${PORT}
  📝 Environment: ${process.env.NODE_ENV || 'development'}
  🔗 API: http://localhost:${PORT}/api
  ❤️  Health: http://localhost:${PORT}/api/health

  `);
});

// Increase timeout for long-running sync operations (15 minutes)
server.timeout = 900000; // 15 minutes in milliseconds
server.keepAliveTimeout = 910000; // Keep-alive slightly longer than timeout
server.headersTimeout = 920000; // Headers timeout slightly longer than keep-alive

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
