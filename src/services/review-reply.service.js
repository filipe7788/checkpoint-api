const prisma = require('../config/database');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');

class ReviewReplyService {
  async createReply(userId, reviewId, text) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundError(ErrorCode.REVIEW_NOT_FOUND);
    }

    const [reply] = await prisma.$transaction([
      prisma.reviewReply.create({
        data: {
          reviewId,
          userId,
          text,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.review.update({
        where: { id: reviewId },
        data: {
          repliesCount: { increment: 1 },
        },
      }),
    ]);

    return reply;
  }

  async getRepliesByReview(reviewId, limit = 20, offset = 0) {
    const replies = await prisma.reviewReply.findMany({
      where: { reviewId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return replies;
  }

  async updateReply(userId, replyId, text) {
    const reply = await prisma.reviewReply.findUnique({
      where: { id: replyId },
    });

    if (!reply) {
      throw new NotFoundError(ErrorCode.REPLY_NOT_FOUND);
    }

    if (reply.userId !== userId) {
      throw new ForbiddenError(ErrorCode.REPLY_NOT_AUTHORIZED);
    }

    const updatedReply = await prisma.reviewReply.update({
      where: { id: replyId },
      data: { text },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return updatedReply;
  }

  async deleteReply(userId, replyId) {
    const reply = await prisma.reviewReply.findUnique({
      where: { id: replyId },
      select: {
        userId: true,
        reviewId: true,
      },
    });

    if (!reply) {
      throw new NotFoundError(ErrorCode.REPLY_NOT_FOUND);
    }

    if (reply.userId !== userId) {
      throw new ForbiddenError(ErrorCode.REPLY_NOT_AUTHORIZED);
    }

    await prisma.$transaction([
      prisma.reviewReply.delete({
        where: { id: replyId },
      }),
      prisma.review.update({
        where: { id: reply.reviewId },
        data: {
          repliesCount: { decrement: 1 },
        },
      }),
    ]);

    return { message: 'Reply deleted successfully' };
  }
}

module.exports = new ReviewReplyService();
