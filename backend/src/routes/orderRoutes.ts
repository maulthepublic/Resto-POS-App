import { Router } from 'express';
import { orderController } from '../controllers/orderController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, orderController.list);
router.get('/kds', authenticate, orderController.getKdsQueue);
router.get('/:id', authenticate, orderController.getById);
router.patch('/:id/status', authenticate, authorize('owner', 'admin', 'chef'), orderController.updateStatus);

export default router;
