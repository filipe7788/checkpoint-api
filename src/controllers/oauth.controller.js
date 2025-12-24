const oauthService = require('../services/oauth.service');

class OAuthController {
  /**
   * Steam OAuth callback - connects Steam account to authenticated user
   */
  async steamCallback(req, res, next) {
    try {
      // req.user is the authenticated JWT user (from auth middleware)
      // req.account is the Steam profile from Passport
      const userId = req.user.userId || req.user.id;
      const steamProfile = req.account;

      await oauthService.connectSteamAccount(userId, steamProfile);

      // Redirect back to mobile app via deep link (or web frontend)
      const redirectUrl = process.env.APP_DEEP_LINK
        ? `${process.env.APP_DEEP_LINK}settings/connections?steam=success`
        : `${process.env.FRONTEND_URL}/settings/connections?steam=success`;

      // Return an HTML page that redirects to the deep link
      // This works better with WebView than direct res.redirect()
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Steam Connected</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
              padding: 20px;
            }
            .container {
              max-width: 400px;
            }
            .success-icon {
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
            <div class="success-icon">✓</div>
            <h1>Steam Connected!</h1>
            <p>Redirecting back to the app...</p>
          </div>
          <script>
            // Redirect immediately
            window.location.href = "${redirectUrl}";

            // Fallback after 1 second
            setTimeout(() => {
              window.location.href = "${redirectUrl}";
            }, 1000);
          </script>
        </body>
        </html>
      `);
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
