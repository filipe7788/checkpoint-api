const reviewService = require('../services/review.service');

class ReviewController {
  async create(req, res, next) {
    try {
      const review = await reviewService.createReview(req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const review = await reviewService.updateReview(req.user.id, req.params.id, req.body);

      res.json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await reviewService.deleteReview(req.user.id, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getByGame(req, res, next) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.user?.id || null;

      const reviews = await reviewService.getReviewsByGame(
        req.params.gameId,
        parseInt(limit),
        parseInt(offset),
        userId
      );

      res.json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      next(error);
    }
  }

  async getByUser(req, res, next) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const currentUserId = req.user?.id || null;

      const reviews = await reviewService.getReviewsByUser(
        req.params.userId,
        parseInt(limit),
        parseInt(offset),
        currentUserId
      );

      res.json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      next(error);
    }
  }

  async like(req, res, next) {
    try {
      const result = await reviewService.likeReview(req.user.id, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async unlike(req, res, next) {
    try {
      const result = await reviewService.unlikeReview(req.user.id, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReviewController();
