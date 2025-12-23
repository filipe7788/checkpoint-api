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
  const state = Buffer.from(JSON.stringify({
    userId,
    timestamp: Date.now()
  })).toString('base64');

  // Store in global map temporarily (will be cleaned up after callback)
  global.steamOAuthStates = global.steamOAuthStates || {};
  global.steamOAuthStates[state] = userId;

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

  // Build Steam OpenID URL - include state in the returnURL path as a query param
  // Since Steam preserves the return_to exactly, we can include state there
  const returnUrl = `${process.env.API_URL}/api/oauth/steam/callback?state=${encodeURIComponent(state)}`;
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

  console.log('[OAUTH STEAM] Generated auth URL with state in return_to');
  console.log('[OAUTH STEAM] State stored in memory for userId:', userId);
  console.log('[OAUTH STEAM] Return URL:', returnUrl);

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
    data: { authUrl, state }
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
    console.log('[STEAM CALLBACK] Full URL:', req.url);
    console.log('[STEAM CALLBACK] Query params:', req.query);
    console.log('[STEAM CALLBACK] Headers:', req.headers);

    const getErrorRedirectUrl = (errorMsg = '') => {
      const baseUrl = process.env.APP_DEEP_LINK
        ? `${process.env.APP_DEEP_LINK}settings/connections?steam=error`
        : `${process.env.FRONTEND_URL}/settings/connections?steam=error`;
      return errorMsg ? `${baseUrl}&msg=${encodeURIComponent(errorMsg)}` : baseUrl;
    };

    // Extract state from cookie (set when initiating OAuth)
    const state = req.cookies?.steam_oauth_state;
    console.log('[STEAM CALLBACK] State from cookie:', state);
    console.log('[STEAM CALLBACK] All cookies:', req.cookies);

    // Retrieve userId from global state map
    let userId;
    if (state && global.steamOAuthStates && global.steamOAuthStates[state]) {
      userId = global.steamOAuthStates[state];
      console.log('[STEAM CALLBACK] Retrieved userId from state map:', userId);

      // Clean up the state immediately after use
      delete global.steamOAuthStates[state];

      // Clear the cookie
      res.clearCookie('steam_oauth_state');
    } else {
      console.error('[STEAM CALLBACK] State not found or invalid');
      console.error('[STEAM CALLBACK] Available states:', Object.keys(global.steamOAuthStates || {}));
      // Continue anyway - we'll handle this after Passport validation
    }

    passport.authenticate('steam', { session: false }, (err, steamProfile) => {
      console.log('[PASSPORT AUTHENTICATE] Error:', err);
      console.log('[PASSPORT AUTHENTICATE] Steam Profile:', steamProfile);

      if (err) {
        console.error('[STEAM CALLBACK] Authentication error:', err);
        console.error('[STEAM CALLBACK] Error details:', JSON.stringify(err, null, 2));
        return res.redirect(getErrorRedirectUrl('auth_failed'));
      }

      if (!steamProfile) {
        console.error('[STEAM CALLBACK] No Steam profile returned');
        return res.redirect(getErrorRedirectUrl('no_profile'));
      }

      if (!userId) {
        console.error('[STEAM CALLBACK] No userId found - state was missing or invalid');
        return res.redirect(getErrorRedirectUrl('no_user'));
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
