const prisma = require('../config/database');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');

class ReportService {
  async createReport(reporterId, type, targetId, reason, description) {
    // Verify target exists based on type
    if (type === 'review') {
      const review = await prisma.review.findUnique({
        where: { id: targetId },
      });

      if (!review) {
        throw new NotFoundError(ErrorCode.REVIEW_NOT_FOUND);
      }
    } else if (type === 'reply') {
      const reply = await prisma.reviewReply.findUnique({
        where: { id: targetId },
      });

      if (!reply) {
        throw new NotFoundError(ErrorCode.REPLY_NOT_FOUND);
      }
    }

    // Check if user already reported this content
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId,
        type,
        targetId,
      },
    });

    if (existingReport) {
      throw new ConflictError(ErrorCode.ALREADY_REPORTED);
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        type,
        targetId,
        reason,
        description,
      },
    });

    return report;
  }

  async getReportById(reportId) {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundError(ErrorCode.REPORT_NOT_FOUND);
    }

    return report;
  }

  async getReports(filters = {}, limit = 20, offset = 0) {
    const { status, type } = filters;

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const reports = await prisma.report.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    const total = await prisma.report.count({ where });

    return {
      reports,
      total,
      limit,
      offset,
    };
  }
}

module.exports = new ReportService();
