import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.loginEmail);
router.post('/login-pin', authController.loginPin);

// Protected routes (requires JWT)
router.get('/me', authenticate, authController.getMe);
router.put('/change-password', authenticate, authController.changePassword);

// Admin/Owner only
router.get('/users', authenticate, authorize('owner', 'admin'), authController.listUsers);
router.patch('/users/:id/toggle', authenticate, authorize('owner'), authController.toggleUser);

export default router;
