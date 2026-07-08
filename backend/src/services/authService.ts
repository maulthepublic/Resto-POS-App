import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../config/db';
import { JwtPayload, UserRole } from '../types';

const SALT_ROUNDS = 12;

function signToken(userId: string, role: UserRole): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId, role } satisfies JwtPayload, process.env.JWT_SECRET!, options);
}

export const authService = {
  // Register new user
  async register(data: {
    name: string;
    email: string;
    password: string;
    pin?: string;
    role: UserRole;
  }) {
    // Check for existing email
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw Object.assign(new Error('Email sudah terdaftar.'), { statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const pinHash = data.pin ? await bcrypt.hash(data.pin, SALT_ROUNDS) : null;

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        pinHash,
        role: data.role,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    const token = signToken(user.id, user.role as UserRole);
    return { user, token };
  },

  // Login with email + password
  async loginEmail(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw Object.assign(new Error('Email atau kata sandi salah.'), { statusCode: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw Object.assign(new Error('Email atau kata sandi salah.'), { statusCode: 401 });
    }

    const token = signToken(user.id, user.role as UserRole);
    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  },

  // Login with PIN (for quick shift-change on cashier tablet)
  async loginPin(pin: string) {
    // Fetch all users with a pinHash and check by comparing
    const users = await prisma.user.findMany({
      where: { pinHash: { not: null }, isActive: true },
    });

    for (const user of users) {
      if (user.pinHash) {
        const match = await bcrypt.compare(pin, user.pinHash);
        if (match) {
          const token = signToken(user.id, user.role as UserRole);
          return {
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
          };
        }
      }
    }

    throw Object.assign(new Error('PIN salah atau akun tidak aktif.'), { statusCode: 401 });
  },

  // Get user profile by ID
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    if (!user) {
      throw Object.assign(new Error('Pengguna tidak ditemukan.'), { statusCode: 404 });
    }
    return user;
  },

  // Change password
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error('User tidak ditemukan.'), { statusCode: 404 });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw Object.assign(new Error('Kata sandi lama tidak cocok.'), { statusCode: 400 });

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    return { message: 'Kata sandi berhasil diperbarui.' };
  },

  // List all users (owner/admin only)
  async listUsers() {
    return prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Toggle user active status
  async toggleUserActive(targetUserId: string, isActive: boolean) {
    return prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: { id: true, name: true, role: true, isActive: true },
    });
  },
};
