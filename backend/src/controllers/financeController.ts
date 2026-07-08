import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth';

export const financeController = {
  // GET /api/finance/ledger — list finance ledger entries
  async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, date, limit = '100' } = req.query;
      const where: any = {};
      if (type) where.type = type;
      if (date) {
        const d = new Date(date as string);
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setHours(23, 59, 59, 999);
        where.occurredAt = { gte: start, lte: end };
      }

      const entries = await prisma.financeLedger.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: Number(limit),
      });
      res.json({ success: true, data: entries });
    } catch (err) { next(err); }
  },

  // POST /api/finance/ledger — create manual entry (petty cash)
  async createLedgerEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { type, category, amount, paymentMethod, description, occurredAt } = req.body;
      if (!type || !category || amount == null) {
        return res.status(400).json({ success: false, message: 'type, category, dan amount wajib diisi.' });
      }

      const entry = await prisma.financeLedger.create({
        data: {
          type,
          category,
          amount: Number(amount),
          paymentMethod: paymentMethod ?? null,
          description: description ?? null,
          occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
          createdBy: req.user?.userId ?? null,
        },
      });
      res.status(201).json({ success: true, data: entry });
    } catch (err) { next(err); }
  },

  // GET /api/finance/stock-movements — list all stock movements
  async getStockMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const { rawMaterialId, limit = '50' } = req.query;
      const where: any = {};
      if (rawMaterialId) where.rawMaterialId = rawMaterialId;

      const movements = await prisma.stockMovement.findMany({
        where,
        include: {
          rawMaterial: { select: { id: true, name: true, unit: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
      });
      res.json({ success: true, data: movements });
    } catch (err) { next(err); }
  },

  // POST /api/finance/stock-movements — manual stock adjustment or opname correction
  async createStockMovement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { rawMaterialId, movementType, quantityDelta, note } = req.body;
      if (!rawMaterialId || !movementType || quantityDelta == null) {
        return res.status(400).json({ success: false, message: 'rawMaterialId, movementType, dan quantityDelta wajib diisi.' });
      }

      const [movement] = await prisma.$transaction([
        prisma.stockMovement.create({
          data: {
            rawMaterialId,
            movementType,
            quantityDelta: Number(quantityDelta),
            note: note ?? null,
            createdBy: req.user?.userId ?? null,
          },
        }),
        prisma.rawMaterial.update({
          where: { id: rawMaterialId },
          data: {
            currentQuantity: { increment: Number(quantityDelta) },
            updatedAt: new Date(),
          },
        }),
      ]);

      res.status(201).json({ success: true, data: movement });
    } catch (err) { next(err); }
  },
};
