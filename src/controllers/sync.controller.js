const syncService = require('../services/sync.service');
const steamService = require('../services/steam.service');
const xboxService = require('../services/xbox.service');

class SyncController {
  async getStatus(req, res, next) {
    try {
      const status = await syncService.getSyncStatus(req.user.id);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  async initiateConnection(req, res, next) {
    try {
      const { platform } = req.params;
      const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');

      let authUrl;

      switch (platform) {
      case 'steam':
        authUrl = steamService.getAuthUrl(`${process.env.APP_URL}/sync/callback/steam`);
        break;

      case 'xbox':
        // xbl.io OAuth flow - user will be redirected back to our callback
        authUrl = xboxService.getAuthUrl();
        // Store user state in session or temp storage for callback
        // For now, we'll use the code parameter directly in callback
        break;

      case 'psn':
        // PSN requires manual NPSSO token input
        return res.json({
          success: true,
          data: {
            message: 'PSN requires manual authentication',
            instructions: [
              '1. Log in to https://my.playstation.com',
              '2. Open browser DevTools > Application > Cookies',
              '3. Copy the value of "npsso" cookie',
              '4. POST to /sync/psn with { npsso, accountId }',
            ],
          },
        });

      case 'nintendo':
      case 'epic':
        return res.status(501).json({
          success: false,
          error: `${platform} sync not yet implemented`,
        });

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown platform',
        });
      }

      res.json({
        success: true,
        data: { authUrl },
      });
    } catch (error) {
      next(error);
    }
  }

  async handleCallback(req, res, next) {
    try {
      const { platform } = req.params;

      let credentials;

      switch (platform) {
      case 'steam':
        // Extract Steam ID from OpenID response
        const claimedId = req.query['openid.claimed_id'];
        const steamId = steamService.extractSteamId(claimedId);

        if (!steamId) {
          throw new Error('Invalid Steam authentication');
        }

        credentials = { steamId };
        break;

      case 'xbox':
        // xbl.io returns 'code' parameter after user authorizes
        if (!req.query.code) {
          throw new Error('Missing authorization code from Xbox');
        }

        credentials = { code: req.query.code };

        // For xbl.io, we need to get userId from session or require authentication
        // Since we're using OAuth flow, user must be authenticated
        if (!req.user || !req.user.id) {
          throw new Error('User not authenticated');
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown platform',
        });
      }

      const connection = await syncService.connectPlatform(req.user.id, platform, credentials);

      // Auto-sync after connection
      try {
        await syncService.syncPlatform(req.user.id, platform);
      } catch (syncError) {
        console.error('[Sync] Auto-sync failed:', syncError);
      }

      // Redirect to app with success (deep link)
      res.redirect(`checkpoint://platforms?connected=${platform}`);
    } catch (error) {
      next(error);
    }
  }

  async connectManual(req, res, next) {
    try {
      const { platform } = req.params;
      const credentials = req.body;

      const connection = await syncService.connectPlatform(req.user.id, platform, credentials);

      res.json({
        success: true,
        data: connection,
      });
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req, res, next) {
    try {
      const { platform } = req.params;

      const result = await syncService.disconnectPlatform(req.user.id, platform);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async sync(req, res, next) {
    try {
      const { platform } = req.params;

      const result = await syncService.syncPlatform(req.user.id, platform);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async syncAll(req, res, next) {
    try {
      const connections = await syncService.getSyncStatus(req.user.id);

      const results = [];

      for (const conn of connections) {
        if (!conn.isActive) continue;

        try {
          const result = await syncService.syncPlatform(req.user.id, conn.platform);
          results.push({ platform: conn.platform, ...result });
        } catch (error) {
          results.push({
            platform: conn.platform,
            success: false,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  async getXboxQuota(req, res, next) {
    try {
      const quotaInfo = xboxService.getQuotaInfo();

      res.json({
        success: true,
        data: quotaInfo,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SyncController();
