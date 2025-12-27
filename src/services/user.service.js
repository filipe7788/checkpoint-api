const prisma = require('../config/database');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');
const { GameStatus } = require('../utils/constants');

class UserService {
  async getUserProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        bio: true,
        role: true,
        followersCount: true,
        followingCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }

    return user;
  }

  async getUserByUsername(username) {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        followersCount: true,
        followingCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }

    // Get game count
    const gamesCount = await prisma.userGame.count({
      where: { userId: user.id },
    });

    return { ...user, gamesCount };
  }

  async updateProfile(userId, updates) {
    // Check if username is already taken
    if (updates.username) {
      const existing = await prisma.user.findFirst({
        where: {
          username: updates.username,
          NOT: { id: userId },
        },
      });

      if (existing) {
        throw new ConflictError(ErrorCode.USERNAME_ALREADY_TAKEN);
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        bio: true,
        role: true,
        followersCount: true,
        followingCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async getUserStats(userId) {
    const [totalGames, completedGames, totalPlaytime, favoriteGames] = await Promise.all([
      prisma.userGame.count({
        where: { userId },
      }),
      prisma.userGame.count({
        where: { userId, status: GameStatus.COMPLETED },
      }),
      prisma.userGame.aggregate({
        where: { userId },
        _sum: { playtime: true },
      }),
      prisma.userGame.count({
        where: { userId, favorite: true },
      }),
    ]);

    // Get most played game
    const mostPlayedGame = await prisma.userGame.findFirst({
      where: {
        userId,
        playtime: { gt: 0 },
      },
      orderBy: { playtime: 'desc' },
      include: {
        game: {
          select: {
            name: true,
            coverUrl: true,
          },
        },
      },
    });

    // Get genre statistics
    const gamesWithGenres = await prisma.userGame.findMany({
      where: { userId },
      include: {
        game: {
          select: { genres: true },
        },
      },
    });

    const genreCounts = {};
    gamesWithGenres.forEach(({ game }) => {
      game.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    });

    const topGenre = Object.entries(genreCounts).sort(([, a], [, b]) => b - a)[0];

    // Get platform statistics
    const platformCounts = await prisma.userGame.groupBy({
      by: ['platform'],
      where: { userId },
      _count: true,
      orderBy: {
        _count: { platform: 'desc' },
      },
    });

    const topPlatform = platformCounts[0];

    return {
      totalGames,
      completedGames,
      totalPlaytime: totalPlaytime._sum.playtime || 0,
      favoriteGames,
      mostPlayedGame: mostPlayedGame
        ? {
            name: mostPlayedGame.game.name,
            coverUrl: mostPlayedGame.game.coverUrl,
            playtime: mostPlayedGame.playtime,
          }
        : null,
      topGenre: topGenre
        ? {
            name: topGenre[0],
            count: topGenre[1],
          }
        : null,
      topPlatform: topPlatform
        ? {
            name: topPlatform.platform,
            count: topPlatform._count,
          }
        : null,
    };
  }

  async getFollowers(userId, limit = 20, offset = 0) {
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            avatar: true,
            bio: true,
            followersCount: true,
          },
        },
      },
    });

    return followers.map(f => f.follower);
  }

  async getFollowing(userId, limit = 20, offset = 0) {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            avatar: true,
            bio: true,
            followersCount: true,
          },
        },
      },
    });

    return following.map(f => f.following);
  }

  async searchUsers(query, limit = 20, offset = 0) {
    if (!query || query.length < 2) {
      return [];
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            username: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
        isBanned: false,
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        followersCount: true,
        followingCount: true,
      },
      take: limit,
      skip: offset,
      orderBy: [
        { followersCount: 'desc' },
        { username: 'asc' },
      ],
    });

    return users;
  }

  async uploadAvatar(userId, file) {
    const uploadService = require('./upload.service');

    // Get current user to check if they have an old avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    // Upload new avatar
    const avatarUrl = await uploadService.uploadAvatar(file, userId);

    // Delete old avatar if exists
    if (currentUser.avatar) {
      await uploadService.deleteAvatar(currentUser.avatar);
    }

    // Update user with new avatar URL
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        bio: true,
        role: true,
        followersCount: true,
        followingCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }
}

module.exports = new UserService();
