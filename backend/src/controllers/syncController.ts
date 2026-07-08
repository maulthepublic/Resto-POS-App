import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { processSyncBatch } from '../services/syncService';
import { SyncMutationItem } from '../types';

export const syncController = {
  // POST /api/sync/push
  async push(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { deviceId, mutations } = req.body;

      if (!deviceId || typeof deviceId !== 'string') {
        return res.status(400).json({ success: false, message: 'deviceId wajib diisi dan harus berupa string.' });
      }

      if (!Array.isArray(mutations) || mutations.length === 0) {
        return res.status(400).json({ success: false, message: 'mutations harus berupa array yang tidak kosong.' });
      }

      // Validate each mutation has required fields
      for (const m of mutations as SyncMutationItem[]) {
        if (!m.idempotencyKey || !m.entityType || !m.operation || !m.entityId) {
          return res.status(400).json({
            success: false,
            message: `Mutation tidak valid: idempotencyKey, entityType, operation, dan entityId wajib ada.`,
          });
        }
      }

      console.log(`[Sync] Received ${mutations.length} mutations from device: ${deviceId}`);

      const results = await processSyncBatch(deviceId, mutations as SyncMutationItem[]);

      const syncedCount = results.filter((r) => r.status === 'synced').length;
      const skippedCount = results.filter((r) => r.status === 'skipped').length;
      const failedCount = results.filter((r) => r.status === 'failed').length;

      console.log(`[Sync] Results — Synced: ${syncedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);

      return res.status(200).json({
        success: true,
        deviceId,
        processedCount: mutations.length,
        syncedCount,
        skippedCount,
        failedCount,
        results,
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/sync/status
  async status(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { deviceId } = req.query;
      const deviceFilter = deviceId ? { deviceId: deviceId as string } : undefined;

      const [total, synced, failed] = await Promise.all([
        (await import('../config/db')).default.syncMutation.count({
          where: deviceFilter,
        }),
        (await import('../config/db')).default.syncMutation.count({
          where: { ...deviceFilter, status: 'synced' },
        }),
        (await import('../config/db')).default.syncMutation.count({
          where: { ...deviceFilter, status: 'failed' },
        }),
      ]);

      return res.status(200).json({
        success: true,
        data: { total, synced, failed, pending: total - synced - failed },
      });
    } catch (err) {
      next(err);
    }
  },
};
