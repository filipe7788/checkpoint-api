const activityService = require('../services/activity.service');

class ActivityController {
  async getFeed(req, res, next) {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const feed = await activityService.getUserFeed(
        req.user.id,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: feed,
      });
    } catch (error) {
      next(error);
    }
  }

  async getNowPlaying(req, res, next) {
    try {
      const { limit = 20 } = req.query;

      const nowPlaying = await activityService.getNowPlaying(
        req.user.id,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: nowPlaying,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ActivityController();
