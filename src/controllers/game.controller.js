const gameService = require('../services/game.service');

class GameController {
  async search(req, res, next) {
    try {
      const { q, limit = 10 } = req.query;

      const games = await gameService.searchGames(q, parseInt(limit));

      res.json({
        success: true,
        data: games,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const game = await gameService.getGameById(req.params.id);

      res.json({
        success: true,
        data: game,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPopular(req, res, next) {
    try {
      const { limit = 20 } = req.query;

      const games = await gameService.getPopularGames(parseInt(limit));

      res.json({
        success: true,
        data: games,
      });
    } catch (error) {
      next(error);
    }
  }

  async getByGenre(req, res, next) {
    try {
      const { genre } = req.params;
      const { limit = 20 } = req.query;

      const games = await gameService.getGamesByGenre(genre, parseInt(limit));

      res.json({
        success: true,
        data: games,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new GameController();
