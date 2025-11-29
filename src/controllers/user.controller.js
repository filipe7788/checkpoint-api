const userService = require('../services/user.service');

class UserController {
  async getMe(req, res, next) {
    try {
      const user = await userService.getUserProfile(req.user.id);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req, res, next) {
    try {
      const user = await userService.updateProfile(req.user.id, req.body);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyStats(req, res, next) {
    try {
      const stats = await userService.getUserStats(req.user.id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserByUsername(req, res, next) {
    try {
      const user = await userService.getUserByUsername(req.params.username);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async getFollowers(req, res, next) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.params.id;

      const followers = await userService.getFollowers(userId, parseInt(limit), parseInt(offset));

      res.json({
        success: true,
        data: followers,
      });
    } catch (error) {
      next(error);
    }
  }

  async getFollowing(req, res, next) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.params.id;

      const following = await userService.getFollowing(userId, parseInt(limit), parseInt(offset));

      res.json({
        success: true,
        data: following,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
