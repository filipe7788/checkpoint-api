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
  // Encode userId in state parameter to retrieve it in callback
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');

  // Manually construct Steam OpenID URL with state parameter
  const returnUrl = `${process.env.API_URL}/api/oauth/steam/callback?state=${state}`;
  const realm = process.env.API_URL;

  // Build Steam OpenID URL
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

  // Return URL for mobile app to open (instead of redirect)
  res.json({
    success: true,
    data: { authUrl }
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
    console.log('[STEAM CALLBACK] Query params:', req.query);

    const getErrorRedirectUrl = () => {
      return process.env.APP_DEEP_LINK
        ? `${process.env.APP_DEEP_LINK}settings/connections?steam=error`
        : `${process.env.FRONTEND_URL}/settings/connections?steam=error`;
    };

    passport.authenticate('steam', { session: false }, (err, steamProfile) => {
      console.log('[STEAM CALLBACK] Passport result:', { err, steamProfile });

      if (err || !steamProfile) {
        console.error('[STEAM CALLBACK] Authentication failed:', err);
        return res.redirect(getErrorRedirectUrl());
      }

      // Attach both user and Steam profile to request
      req.account = steamProfile;

      // Try to get userId from query param (we'll pass it in the OAuth flow)
      // This is a workaround since we can't use session easily
      const state = req.query.state;
      console.log('[STEAM CALLBACK] State:', state);

      if (state) {
        try {
          const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
          console.log('[STEAM CALLBACK] State data:', stateData);
          req.user = { userId: stateData.userId };
        } catch (e) {
          console.error('[STEAM CALLBACK] Failed to decode state:', e);
          return res.redirect(getErrorRedirectUrl());
        }
      }

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
