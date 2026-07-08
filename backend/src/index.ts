import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Routes
import authRoutes from './routes/authRoutes';
import syncRoutes from './routes/syncRoutes';
import masterDataRoutes from './routes/masterDataRoutes';
import orderRoutes from './routes/orderRoutes';
import financeRoutes from './routes/financeRoutes';
import reportRoutes from './routes/reportRoutes';

// Middleware
import { errorHandler } from './middlewares/errorHandler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));        // Allow large sync payloads
app.use(express.urlencoded({ extended: true }));

// ── Route Mounting ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api', masterDataRoutes);               // /api/menu-items, /api/categories, etc.
app.use('/api/orders', orderRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/reports', reportRoutes);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Resto POS Backend API',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} tidak ditemukan.` });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   Resto POS Backend API v1.1.0           ║`);
  console.log(`║   Listening on: http://localhost:${PORT}    ║`);
  console.log(`║   Mode: ${(process.env.NODE_ENV || 'development').padEnd(33)}║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
  console.log('  API Routes:');
  console.log('  ✓  /api/auth        — Authentication & User Management');
  console.log('  ✓  /api/sync        — Offline-First Idempotent Sync Push');
  console.log('  ✓  /api/menu-items  — Menu Items CRUD');
  console.log('  ✓  /api/categories  — Menu Categories CRUD');
  console.log('  ✓  /api/raw-materials — Stock & Ingredients CRUD');
  console.log('  ✓  /api/recipes     — BOM Recipes CRUD');
  console.log('  ✓  /api/orders      — Orders & KDS Queue');
  console.log('  ✓  /api/finance     — Finance Ledger & Stock Movements');
  console.log('  ✓  /api/reports     — Daily Z-Report & Analytics\n');
});

export default app;
