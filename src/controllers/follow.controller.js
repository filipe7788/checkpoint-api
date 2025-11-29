const followService = require('../services/follow.service');

class FollowController {
  async follow(req, res, next) {
    try {
      const result = await followService.followUser(req.user.id, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async unfollow(req, res, next) {
    try {
      const result = await followService.unfollowUser(req.user.id, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkFollowing(req, res, next) {
    try {
      const result = await followService.isFollowing(req.user.id, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FollowController();
