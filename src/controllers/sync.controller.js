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
        // Xbox requires manual gamertag input
        return res.json({
          success: true,
          data: {
            message: 'Xbox requires manual authentication',
            instructions: [
              '1. Enter your Xbox Gamertag',
              '2. POST to /sync/xbox with { gamertag }',
            ],
          },
        });

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

  async streamProgress(req, res, next) {
    try {
      const { platform } = req.params;

      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Create progress callback
      const onProgress = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Start sync with progress updates
      try {
        const result = await syncService.syncPlatform(req.user.id, platform, onProgress);

        // Send final result
        res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
        res.end();
      } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
      }
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

  // TODO: Implement getXboxQuota when OpenXBL provides quota info endpoint
  // async getXboxQuota(req, res, next) {
  //   try {
  //     const quotaInfo = xboxService.getQuotaInfo();
  //
  //     res.json({
  //       success: true,
  //       data: quotaInfo,
  //     });
  //   } catch (error) {
  //     next(error);
  //   }
  // }
}

module.exports = new SyncController();
