const reportService = require('../services/report.service');

class ReportController {
  async createReport(req, res, next) {
    try {
      const { type, targetId, reason, description } = req.body;
      const reporterId = req.user.id;

      const report = await reportService.createReport(
        reporterId,
        type,
        targetId,
        reason,
        description
      );

      res.status(201).json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  async getReport(req, res, next) {
    try {
      const { id } = req.params;

      const report = await reportService.getReportById(id);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  async getReports(req, res, next) {
    try {
      const { status, type, limit = 20, offset = 0 } = req.query;

      const result = await reportService.getReports({ status, type }, Number(limit), Number(offset));

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportController();
