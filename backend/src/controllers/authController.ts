import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AuthenticatedRequest } from '../middlewares/auth';

export const authController = {
  // POST /api/auth/register
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password, pin, role } = req.body;
      if (!name || !email || !password || !role) {
        return res.status(400).json({ success: false, message: 'name, email, password, dan role wajib diisi.' });
      }
      const result = await authService.register({ name, email, password, pin, role });
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/auth/login
  async loginEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'email dan password wajib diisi.' });
      }
      const result = await authService.loginEmail(email, password);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/auth/login-pin
  async loginPin(req: Request, res: Response, next: NextFunction) {
    try {
      const { pin } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, message: 'PIN wajib diisi.' });
      }
      const result = await authService.loginPin(pin);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/auth/me
  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const profile = await authService.getProfile(req.user!.userId);
      return res.status(200).json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  },

  // PUT /api/auth/change-password
  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'currentPassword dan newPassword wajib diisi.' });
      }
      const result = await authService.changePassword(req.user!.userId, currentPassword, newPassword);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/auth/users
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await authService.listUsers();
      return res.status(200).json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/auth/users/:id/toggle
  async toggleUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isActive harus berupa boolean.' });
      }
      const user = await authService.toggleUserActive(id, isActive);
      return res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/auth/users/:id/set-pin
  async setPin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { pin } = req.body;
      if (!pin || typeof pin !== 'string') {
        return res.status(400).json({ success: false, message: 'pin wajib diisi dan harus berupa string.' });
      }
      const result = await authService.setPin(id, pin);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
