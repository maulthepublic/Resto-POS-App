import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/reportService';

export const reportController = {
  // GET /api/reports/daily?date=YYYY-MM-DD
  async getDailySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = req.query;
      const data = await reportService.getDailySummary(date as string | undefined);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // GET /api/reports/sales?startDate=&endDate=
  async getSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'startDate dan endDate wajib diisi.' });
      }
      const data = await reportService.getSalesReport(startDate as string, endDate as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // GET /api/reports/stock-reconciliation
  async getStockReconciliation(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getStockReconciliation();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // GET /api/reports/top-selling?limit=10
  async getTopSelling(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit ?? 10);
      const data = await reportService.getTopSellingItems(limit);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};
