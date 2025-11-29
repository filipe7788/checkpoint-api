const prisma = require('../config/database');

class ActivityService {
  async createActivity(data) {
    const { userId, type, targetGameId, targetReviewId, targetUserId, metadata } = data;

    const activity = await prisma.activity.create({
      data: {
        userId,
        type,
        targetGameId,
        targetReviewId,
        targetUserId,
        metadata,
      },
    });

    return activity;
  }

  async getUserFeed(userId, limit = 20, offset = 0) {
    // Get IDs of users that the current user follows
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return [];
    }

    // Get activities from followed users
    const activities = await prisma.activity.findMany({
      where: {
        userId: { in: followingIds },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        targetGame: {
          select: {
            id: true,
            name: true,
            coverUrl: true,
          },
        },
        targetReview: {
          select: {
            id: true,
            rating: true,
            text: true,
            likesCount: true,
          },
        },
      },
    });

    return activities;
  }

  async getNowPlaying(userId, limit = 20) {
    // Get IDs of users that the current user follows
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return [];
    }

    // Get currently playing games from followed users
    // Updated within last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const nowPlaying = await prisma.userGame.findMany({
      where: {
        userId: { in: followingIds },
        status: 'playing',
        updatedAt: { gte: oneDayAgo },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
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
    });

    return nowPlaying;
  }
}

module.exports = new ActivityService();
