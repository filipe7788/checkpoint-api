const prisma = require('../config/database');
const activityService = require('./activity.service');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../utils/errors');

class ReviewService {
  async createReview(userId, data) {
    const { userGameId, rating, text, containsSpoilers } = data;

    // Verify the userGame belongs to this user
    const userGame = await prisma.userGame.findFirst({
      where: {
        id: userGameId,
        userId,
      },
      include: { game: true },
    });

    if (!userGame) {
      throw new NotFoundError('Game not found in your library');
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: { userGameId },
    });

    if (existingReview) {
      throw new BadRequestError('Review already exists for this game');
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        userGameId,
        rating,
        text: text || null,
        containsSpoilers: containsSpoilers || false,
      },
      include: {
        userGame: {
          include: {
            game: true,
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Create activity
    await activityService.createActivity({
      userId,
      type: 'reviewed',
      targetGameId: userGame.game.id,
      targetReviewId: review.id,
      metadata: { rating },
    });

    return review;
  }

  async updateReview(userId, reviewId, updates) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        userGame: {
          select: { userId: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    if (review.userGame.userId !== userId) {
      throw new ForbiddenError('Not authorized to update this review');
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: updates,
      include: {
        userGame: {
          include: {
            game: true,
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return updatedReview;
  }

  async deleteReview(userId, reviewId) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        userGame: {
          select: { userId: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    if (review.userGame.userId !== userId) {
      throw new ForbiddenError('Not authorized to delete this review');
    }

    await prisma.review.delete({
      where: { id: reviewId },
    });

    return { message: 'Review deleted successfully' };
  }

  async getReviewsByGame(gameId, limit = 20, offset = 0) {
    const reviews = await prisma.review.findMany({
      where: {
        userGame: {
          gameId,
        },
      },
      take: limit,
      skip: offset,
      orderBy: { likesCount: 'desc' },
      include: {
        userGame: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            game: {
              select: {
                id: true,
                name: true,
                coverUrl: true,
              },
            },
          },
        },
      },
    });

    return reviews;
  }

  async getReviewsByUser(userId, limit = 20, offset = 0) {
    const reviews = await prisma.review.findMany({
      where: {
        userGame: {
          userId,
        },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        userGame: {
          include: {
            game: {
              select: {
                id: true,
                name: true,
                coverUrl: true,
              },
            },
          },
        },
      },
    });

    return reviews;
  }

  async likeReview(userId, reviewId) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        userGame: {
          select: { userId: true, gameId: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Check if already liked
    const existing = await prisma.reviewLike.findUnique({
      where: {
        userId_reviewId: {
          userId,
          reviewId,
        },
      },
    });

    if (existing) {
      throw new BadRequestError('Already liked this review');
    }

    // Create like and increment count
    await prisma.$transaction([
      prisma.reviewLike.create({
        data: {
          userId,
          reviewId,
        },
      }),
      prisma.review.update({
        where: { id: reviewId },
        data: {
          likesCount: { increment: 1 },
        },
      }),
    ]);

    // Create activity
    await activityService.createActivity({
      userId,
      type: 'liked_review',
      targetReviewId: reviewId,
      targetGameId: review.userGame.gameId,
      targetUserId: review.userGame.userId,
    });

    return { message: 'Review liked successfully' };
  }

  async unlikeReview(userId, reviewId) {
    const like = await prisma.reviewLike.findUnique({
      where: {
        userId_reviewId: {
          userId,
          reviewId,
        },
      },
    });

    if (!like) {
      throw new NotFoundError('Like not found');
    }

    // Delete like and decrement count
    await prisma.$transaction([
      prisma.reviewLike.delete({
        where: {
          userId_reviewId: {
            userId,
            reviewId,
          },
        },
      }),
      prisma.review.update({
        where: { id: reviewId },
        data: {
          likesCount: { decrement: 1 },
        },
      }),
    ]);

    return { message: 'Review unliked successfully' };
  }
}

module.exports = new ReviewService();
