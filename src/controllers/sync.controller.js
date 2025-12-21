const syncService = require('../services/sync.service');

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
      const onProgress = data => {
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

  async createMapping(req, res, next) {
    try {
      const { platform, originalTitle, gameId } = req.body;

      const mapping = await syncService.createTitleMapping(platform, originalTitle, gameId);

      res.json({
        success: true,
        data: mapping,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteMapping(req, res, next) {
    try {
      const { platform, originalTitle } = req.body;

      const result = await syncService.deleteTitleMapping(platform, originalTitle);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMappings(req, res, next) {
    try {
      const { platform } = req.query;

      const mappings = await syncService.getTitleMappings(platform);

      res.json({
        success: true,
        data: mappings,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SyncController();
