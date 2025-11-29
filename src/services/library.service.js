const prisma = require('../config/database');
const gameService = require('./game.service');
const activityService = require('./activity.service');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');

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
      throw new ConflictError('Game already in library for this platform');
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
    if (status === 'playing') {
      await activityService.createActivity({
        userId,
        type: 'started_playing',
        targetGameId: game.id,
      });
    } else if (status === 'completed') {
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

    const library = await prisma.userGame.findMany({
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

    return library;
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
      throw new NotFoundError('Game not found in library');
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
      throw new NotFoundError('Game not found in library');
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
      if (updates.status === 'playing' && previousStatus !== 'playing') {
        await activityService.createActivity({
          userId,
          type: 'started_playing',
          targetGameId: existing.game.id,
        });
      } else if (updates.status === 'completed' && previousStatus !== 'completed') {
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
      throw new NotFoundError('Game not found in library');
    }

    await prisma.userGame.delete({
      where: { id: userGameId },
    });

    return { message: 'Game removed from library' };
  }
}

module.exports = new LibraryService();
