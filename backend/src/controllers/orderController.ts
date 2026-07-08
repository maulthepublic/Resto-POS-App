import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth';

export const orderController = {
  // GET /api/orders — list orders with filters
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, date, limit = '50' } = req.query;

      const where: any = {};
      if (status) where.status = status;
      if (date) {
        const d = new Date(date as string);
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setHours(23, 59, 59, 999);
        where.paidAt = { gte: start, lte: end };
      }

      const orders = await prisma.order.findMany({
        where,
        include: {
          orderItems: true,
          payments: true,
        },
        orderBy: { paidAt: 'desc' },
        take: Number(limit),
      });

      res.json({ success: true, data: orders });
    } catch (err) { next(err); }
  },

  // GET /api/orders/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { orderItems: true, payments: true },
      });
      if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  },

  // PATCH /api/orders/:id/status — update KDS cooking status
  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const validStatuses = ['cooking', 'ready', 'served', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `Status harus salah satu dari: ${validStatuses.join(', ')}.` });
      }

      const order = await prisma.order.update({
        where: { id: req.params.id },
        data: { status, updatedAt: new Date() },
      });

      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  },

  // GET /api/orders/kds — active kitchen queue (cooking + ready + paid)
  async getKdsQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const orders = await prisma.order.findMany({
        where: { status: { in: ['paid', 'cooking', 'ready'] } },
        include: { orderItems: true },
        orderBy: { paidAt: 'asc' },
      });
      res.json({ success: true, data: orders });
    } catch (err) { next(err); }
  },
};
