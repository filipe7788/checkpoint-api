const prisma = require('../config/database');
const activityService = require('./activity.service');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');

class FollowService {
  async followUser(followerId, followingId) {
    if (followerId === followingId) {
      throw new BadRequestError(ErrorCode.CANNOT_FOLLOW_YOURSELF);
    }

    // Check if user to follow exists
    const userToFollow = await prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!userToFollow) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existing) {
      throw new BadRequestError(ErrorCode.ALREADY_FOLLOWING);
    }

    // Create follow and update counters
    await prisma.$transaction([
      prisma.follow.create({
        data: {
          followerId,
          followingId,
        },
      }),
      prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: followingId },
        data: { followersCount: { increment: 1 } },
      }),
    ]);

    // Create activity
    await activityService.createActivity({
      userId: followerId,
      type: 'followed_user',
      targetUserId: followingId,
    });

    return { message: 'Successfully followed user' };
  }

  async unfollowUser(followerId, followingId) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!follow) {
      throw new NotFoundError(ErrorCode.NOT_FOLLOWING);
    }

    // Delete follow and update counters
    await prisma.$transaction([
      prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      }),
      prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { decrement: 1 } },
      }),
      prisma.user.update({
        where: { id: followingId },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);

    return { message: 'Successfully unfollowed user' };
  }

  async isFollowing(followerId, followingId) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return { isFollowing: !!follow };
  }
}

module.exports = new FollowService();
