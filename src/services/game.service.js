const igdbClient = require('../config/igdb');
const prisma = require('../config/database');
const { NotFoundError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');

class GameService {
  async searchGames(query, limit = 10) {
    // Search in IGDB
    const igdbGames = await igdbClient.searchGames(query, limit);

    // Cache games in database
    for (const igdbGame of igdbGames) {
      await this.cacheGame(igdbGame);
    }

    return igdbGames.map(this.formatIGDBGame);
  }

  async getGameById(gameId) {
    // Try to find in cache first
    let game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundError(ErrorCode.GAME_NOT_FOUND);
    }

    return game;
  }

  async getGameByIgdbId(igdbId) {
    // Try cache first
    let game = await prisma.game.findUnique({
      where: { igdbId },
    });

    // If not in cache, fetch from IGDB
    if (!game) {
      const igdbGame = await igdbClient.getGameById(igdbId);
      if (!igdbGame) {
        throw new NotFoundError(ErrorCode.GAME_NOT_FOUND);
      }
      game = await this.cacheGame(igdbGame);
    }

    return game;
  }

  async findOrCreateByIgdbId(igdbId) {
    // Alias for getGameByIgdbId - used by sync service
    return this.getGameByIgdbId(igdbId);
  }

  async getPopularGames(limit = 20) {
    const igdbGames = await igdbClient.getPopularGames(limit);

    // Cache games
    for (const igdbGame of igdbGames) {
      await this.cacheGame(igdbGame);
    }

    return igdbGames.map(this.formatIGDBGame);
  }

  async getGamesByGenre(genre, limit = 20) {
    const igdbGames = await igdbClient.getGamesByGenre(genre, limit);

    // Cache games
    for (const igdbGame of igdbGames) {
      await this.cacheGame(igdbGame);
    }

    return igdbGames.map(this.formatIGDBGame);
  }

  async cacheGame(igdbGame) {
    const gameData = {
      igdbId: igdbGame.id,
      name: igdbGame.name,
      slug: igdbGame.slug,
      summary: igdbGame.summary || null,
      coverUrl: igdbGame.cover?.url ? `https:${igdbGame.cover.url}` : null,
      releaseDate: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000)
        : null,
      genres: igdbGame.genres?.map(g => g.name) || [],
      platforms: igdbGame.platforms?.map(p => p.name) || [],
      igdbRating: igdbGame.aggregated_rating || null,
    };

    const game = await prisma.game.upsert({
      where: { igdbId: igdbGame.id },
      update: gameData,
      create: gameData,
    });

    return game;
  }

  formatIGDBGame(igdbGame) {
    return {
      igdbId: igdbGame.id,
      name: igdbGame.name,
      slug: igdbGame.slug,
      summary: igdbGame.summary || null,
      coverUrl: igdbGame.cover?.url ? `https:${igdbGame.cover.url}` : null,
      releaseDate: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000).toISOString()
        : null,
      genres: igdbGame.genres?.map(g => g.name) || [],
      platforms: igdbGame.platforms?.map(p => p.name) || [],
      rating: igdbGame.aggregated_rating || null,
    };
  }
}

module.exports = new GameService();
