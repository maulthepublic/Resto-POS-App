import { Router } from 'express';
import { reportController } from '../controllers/reportController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// All report routes require authentication, and owner/admin only
router.get('/daily', authenticate, authorize('owner', 'admin'), reportController.getDailySummary);
router.get('/sales', authenticate, authorize('owner', 'admin'), reportController.getSalesReport);
router.get('/stock-reconciliation', authenticate, authorize('owner', 'admin'), reportController.getStockReconciliation);
router.get('/top-selling', authenticate, authorize('owner', 'admin'), reportController.getTopSelling);

export default router;
