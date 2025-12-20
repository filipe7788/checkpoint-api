const prisma = require('../config/database');
const gameService = require('./game.service');
const activityService = require('./activity.service');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');
const { GameStatus } = require('../utils/constants');

class LibraryService {
  async addToLibrary(userId, data) {
    const { igdbId, status, platform, playtime, startedAt, completedAt, favorite } = data;

    // Get or cache game from IGDB
    const game = await gameService.getGameByIgdbId(igdbId);

    // Check if already in library for this platform
    const existing = await prisma.userGame.findUnique({
      where: {
        userId_gameId_platform: {
          userId,
          gameId: game.id,
          platform,
        },
      },
    });

    if (existing) {
      throw new ConflictError(ErrorCode.GAME_ALREADY_IN_LIBRARY);
    }

    // Create library entry
    const userGame = await prisma.userGame.create({
      data: {
        userId,
        gameId: game.id,
        status,
        platform,
        playtime: playtime || 0,
        startedAt: startedAt ? new Date(startedAt) : null,
        completedAt: completedAt ? new Date(completedAt) : null,
        favorite: favorite || false,
      },
      include: {
        game: true,
      },
    });

    // Create activity if status is playing or completed
    if (status === GameStatus.PLAYING) {
      await activityService.createActivity({
        userId,
        type: 'started_playing',
        targetGameId: game.id,
      });
    } else if (status === GameStatus.COMPLETED) {
      await activityService.createActivity({
        userId,
        type: 'completed',
        targetGameId: game.id,
      });
    }

    return userGame;
  }

  async getLibrary(userId, filters = {}) {
    const { status, platform, favorite } = filters;

    const where = { userId };

    if (status) where.status = status;
    if (platform) where.platform = platform;
    if (favorite !== undefined) where.favorite = favorite === 'true';

    const userGames = await prisma.userGame.findMany({
      where,
      include: {
        game: true,
        review: {
          select: {
            id: true,
            rating: true,
            likesCount: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Group by game and aggregate platforms
    const gameMap = new Map();

    for (const userGame of userGames) {
      const gameId = userGame.game.id;

      if (!gameMap.has(gameId)) {
        gameMap.set(gameId, {
          ...userGame,
          platforms: [userGame.platform],
          totalPlaytime: userGame.playtime || 0,
        });
      } else {
        const existing = gameMap.get(gameId);
        existing.platforms.push(userGame.platform);
        existing.totalPlaytime += userGame.playtime || 0;

        // Keep the most recent playtime and status
        if (userGame.updatedAt > existing.updatedAt) {
          existing.status = userGame.status;
          existing.updatedAt = userGame.updatedAt;
        }

        // Keep review if exists
        if (userGame.review) {
          existing.review = userGame.review;
        }
      }
    }

    return Array.from(gameMap.values());
  }

  async getLibraryItem(userId, userGameId) {
    const userGame = await prisma.userGame.findFirst({
      where: {
        id: userGameId,
        userId,
      },
      include: {
        game: true,
        review: {
          include: {
            likes: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!userGame) {
      throw new NotFoundError(ErrorCode.GAME_NOT_IN_LIBRARY);
    }

    return userGame;
  }

  async updateLibraryItem(userId, userGameId, updates) {
    const existing = await prisma.userGame.findFirst({
      where: {
        id: userGameId,
        userId,
      },
      include: { game: true },
    });

    if (!existing) {
      throw new NotFoundError(ErrorCode.GAME_NOT_IN_LIBRARY);
    }

    // Track status change for activities
    const statusChanged = updates.status && updates.status !== existing.status;
    const previousStatus = existing.status;

    const userGame = await prisma.userGame.update({
      where: { id: userGameId },
      data: {
        ...updates,
        startedAt: updates.startedAt ? new Date(updates.startedAt) : undefined,
        completedAt: updates.completedAt ? new Date(updates.completedAt) : undefined,
      },
      include: {
        game: true,
      },
    });

    // Create activity for status changes
    if (statusChanged) {
      if (updates.status === GameStatus.PLAYING && previousStatus !== GameStatus.PLAYING) {
        await activityService.createActivity({
          userId,
          type: 'started_playing',
          targetGameId: existing.game.id,
        });
      } else if (
        updates.status === GameStatus.COMPLETED &&
        previousStatus !== GameStatus.COMPLETED
      ) {
        await activityService.createActivity({
          userId,
          type: 'completed',
          targetGameId: existing.game.id,
        });
      }
    }

    return userGame;
  }

  async removeFromLibrary(userId, userGameId) {
    const existing = await prisma.userGame.findFirst({
      where: {
        id: userGameId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundError(ErrorCode.GAME_NOT_IN_LIBRARY);
    }

    await prisma.userGame.delete({
      where: { id: userGameId },
    });

    return { message: 'Game removed from library' };
  }
}

module.exports = new LibraryService();
