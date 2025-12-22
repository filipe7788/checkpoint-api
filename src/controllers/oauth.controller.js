const oauthService = require('../services/oauth.service');

class OAuthController {
  /**
   * Steam OAuth callback - connects Steam account to authenticated user
   */
  async steamCallback(req, res, next) {
    try {
      // req.user is the authenticated JWT user (from auth middleware)
      // req.account is the Steam profile from Passport
      const userId = req.user.userId;
      const steamProfile = req.account;

      await oauthService.connectSteamAccount(userId, steamProfile);

      // Redirect back to mobile app via deep link (or web frontend)
      const redirectUrl = process.env.APP_DEEP_LINK
        ? `${process.env.APP_DEEP_LINK}settings/connections?steam=success`
        : `${process.env.FRONTEND_URL}/settings/connections?steam=success`;
      res.redirect(redirectUrl);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect a platform OAuth connection
   */
  async disconnect(req, res, next) {
    try {
      const userId = req.user.userId;
      const { provider } = req.params;

      await oauthService.disconnectAccount(userId, provider);

      res.json({
        success: true,
        message: `${provider} account disconnected successfully`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all OAuth connections for the authenticated user
   */
  async getConnections(req, res, next) {
    try {
      const userId = req.user.userId;

      const connections = await oauthService.getUserConnections(userId);

      res.json({
        success: true,
        data: connections,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh OAuth data for a platform (e.g., update profile info)
   */
  async refreshConnection(req, res, next) {
    try {
      const userId = req.user.userId;
      const { provider } = req.params;

      const connection = await oauthService.refreshConnection(userId, provider);

      res.json({
        success: true,
        data: connection,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OAuthController();
