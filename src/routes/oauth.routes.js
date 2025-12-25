const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const passport = require('../config/passport');

/**
 * Steam OAuth Routes
 * These routes are used to connect a Steam account to an existing user account
 * (different from auth routes which are for login/registration)
 */

/**
 * @route   GET /oauth/steam
 * @desc    Initiate Steam OAuth connection (user must be logged in)
 * @access  Private
 */
router.get('/steam', authenticate, (req, res) => {
  const userId = req.user.id;

  // Create a unique state token
  const state = Buffer.from(
    JSON.stringify({
      userId,
      timestamp: Date.now(),
    })
  ).toString('base64');

  // Store in global map temporarily (will be cleaned up after callback)
  global.steamOAuthStates = global.steamOAuthStates || {};
  global.steamOAuthStates[state] = userId;

  // Also store the most recent OAuth attempt (fallback if cookie doesn't work)
  global.lastSteamOAuthAttempt = {
    userId,
    timestamp: Date.now(),
    state,
  };

  // Clean up old states (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  Object.keys(global.steamOAuthStates).forEach(key => {
    try {
      const data = JSON.parse(Buffer.from(key, 'base64').toString());
      if (data.timestamp < tenMinutesAgo) {
        delete global.steamOAuthStates[key];
      }
    } catch (e) {
      delete global.steamOAuthStates[key];
    }
  });

  // Build Steam OpenID URL WITHOUT state in returnURL (Passport validates exact match)
  // State will be passed via cookie instead
  const returnUrl = `${process.env.API_URL}/api/oauth/steam/callback`;
  const realm = process.env.API_URL;
  const steamOpenIdUrl = 'https://steamcommunity.com/openid/login';

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnUrl,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  const authUrl = `${steamOpenIdUrl}?${params.toString()}`;
  // Set state in a secure HTTP-only cookie that will be sent back on callback
  res.cookie('steam_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  // Return URL for mobile app to open
  res.json({
    success: true,
    data: { authUrl, state },
  });
});

/**
 * @route   GET /oauth/steam/callback
 * @desc    Steam OAuth callback - connects Steam account to user
 * @access  Public (but requires prior authentication)
 */
router.get(
  '/steam/callback',
  (req, res, next) => {
    const sendErrorPage = (errorMsg = 'auth_failed') => {
      const redirectUrl = process.env.APP_DEEP_LINK
        ? `${process.env.APP_DEEP_LINK}settings/connections?steam=error&msg=${encodeURIComponent(errorMsg)}`
        : `${process.env.FRONTEND_URL}/settings/connections?steam=error&msg=${encodeURIComponent(errorMsg)}`;

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Steam Connection Failed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
              text-align: center;
              padding: 20px;
            }
            .container {
              max-width: 400px;
            }
            .error-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 10px;
            }
            p {
              font-size: 16px;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✗</div>
            <h1>Connection Failed</h1>
            <p>Redirecting back to the app...</p>
          </div>
          <script>
            window.location.href = "${redirectUrl}";
            setTimeout(() => {
              window.location.href = "${redirectUrl}";
            }, 1000);
          </script>
        </body>
        </html>
      `);
    };

    // Extract state from cookie (primary) or query param (fallback)
    const state = req.cookies?.steam_oauth_state || req.query.state;

    // Retrieve userId from global state map
    let userId;
    if (state && global.steamOAuthStates && global.steamOAuthStates[state]) {
      userId = global.steamOAuthStates[state];
      // Clean up the state immediately after use
      delete global.steamOAuthStates[state];

      // Clear the cookie
      res.clearCookie('steam_oauth_state');
    } else {
      // Fallback: use the most recent OAuth attempt (within last 10 minutes)
      if (global.lastSteamOAuthAttempt) {
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        if (global.lastSteamOAuthAttempt.timestamp > tenMinutesAgo) {
          userId = global.lastSteamOAuthAttempt.userId;

          // Clean up
          delete global.lastSteamOAuthAttempt;
        }
      }
    }

    passport.authenticate('steam', { session: false }, (err, steamProfile) => {
      if (err) {
        return sendErrorPage('auth_failed');
      }

      if (!steamProfile) {
        return sendErrorPage('no_profile');
      }

      if (!userId) {
        return sendErrorPage('no_user');
      }

      // Attach Steam profile and userId to request
      req.account = steamProfile;
      req.user = { userId };

      next();
    })(req, res, next);
  },
  oauthController.steamCallback
);

/**
 * @route   DELETE /oauth/:provider
 * @desc    Disconnect an OAuth provider
 * @access  Private
 */
router.delete('/:provider', authenticate, oauthController.disconnect);

/**
 * @route   GET /oauth/connections
 * @desc    Get all OAuth connections for authenticated user
 * @access  Private
 */
router.get('/connections', authenticate, oauthController.getConnections);

/**
 * @route   POST /oauth/:provider/refresh
 * @desc    Refresh OAuth connection data
 * @access  Private
 */
router.post('/:provider/refresh', authenticate, oauthController.refreshConnection);

module.exports = router;
