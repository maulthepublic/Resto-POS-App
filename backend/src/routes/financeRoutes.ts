import { Router } from 'express';
import { financeController } from '../controllers/financeController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Finance Ledger (Buku Kas)
router.get('/ledger', authenticate, authorize('owner', 'admin'), financeController.getLedger);
router.post('/ledger', authenticate, authorize('owner', 'admin', 'cashier'), financeController.createLedgerEntry);

// Stock Movements
router.get('/stock-movements', authenticate, authorize('owner', 'admin'), financeController.getStockMovements);
router.post('/stock-movements', authenticate, authorize('owner', 'admin'), financeController.createStockMovement);

export default router;
