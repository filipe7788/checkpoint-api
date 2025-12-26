const reviewReplyService = require('../services/review-reply.service');

class ReviewReplyController {
  async create(req, res, next) {
    try {
      const { text } = req.body;
      const reply = await reviewReplyService.createReply(
        req.user.id,
        req.params.reviewId,
        text
      );

      res.status(201).json({
        success: true,
        data: reply,
      });
    } catch (error) {
      next(error);
    }
  }

  async getByReview(req, res, next) {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const replies = await reviewReplyService.getRepliesByReview(
        req.params.reviewId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: replies,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { text } = req.body;
      const reply = await reviewReplyService.updateReply(
        req.user.id,
        req.params.id,
        text
      );

      res.json({
        success: true,
        data: reply,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await reviewReplyService.deleteReply(req.user.id, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReviewReplyController();
