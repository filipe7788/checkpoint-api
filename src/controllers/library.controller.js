const libraryService = require('../services/library.service');

class LibraryController {
  async add(req, res, next) {
    try {
      const userGame = await libraryService.addToLibrary(req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: userGame,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const library = await libraryService.getLibrary(req.user.id, req.query);

      res.json({
        success: true,
        data: library,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const userGame = await libraryService.getLibraryItem(req.user.id, req.params.id);

      res.json({
        success: true,
        data: userGame,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const userGame = await libraryService.updateLibraryItem(req.user.id, req.params.id, req.body);

      res.json({
        success: true,
        data: userGame,
      });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const result = await libraryService.removeFromLibrary(req.user.id, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LibraryController();
