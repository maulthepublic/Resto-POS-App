import { Router } from 'express';
import { syncController } from '../controllers/syncController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All sync routes require authentication
router.post('/push', authenticate, syncController.push);
router.get('/status', authenticate, syncController.status);

export default router;
