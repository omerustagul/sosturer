import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import prisma from './lib/prisma';
import { logger } from './utils/logger';
import { initSocket } from './lib/socket';

// Import Routes
import machineRoutes from './routes/machines';
import operatorRoutes from './routes/operators';
import shiftRoutes from './routes/shifts';
import productRoutes from './routes/products';
import productionRecordRoutes from './routes/production-records';
import reportRoutes from './routes/reports';
import analyticsRoutes from './routes/analytics';
import systemRoutes from './routes/system';
import authRoutes from './routes/auth';
import templateRoutes from './routes/templates';
import importRoutes from './routes/imports';
import appSettingsRoutes from './routes/settings';
import overtimeRoutes from './routes/overtime';
import departmentRoutes from './routes/departments';
import departmentRoleRoutes from './routes/departmentRoles';
import notificationRoutes from './routes/notifications';
import inventoryRoutes from './routes/inventory';
import salesRoutes from './routes/sales';
import planningRoutes from './routes/planning';
import { authenticateToken } from './middleware/auth';
import { startScheduler } from './services/scheduler';

dotenv.config();

const app: Express = express();
const port = Number(process.env.PORT || 3001);
const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// Start Background Scheduler
startScheduler();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: false // HTTP ile çalışırken HSTS kapatılmalı
})); // Güvenlik headerları (LAN ortamı için gevşetildi)


app.use(compression()); // Gzip sıkıştırma optimizasyonu
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Http Request Logging with Morgan & Winston
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Health Check
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'OK', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'disconnected', error: String(error) });
  }
});

// Define Routes
app.use('/api/auth', authRoutes);

// Protect all other /api routes
app.use('/api', authenticateToken);

app.use('/api/machines', machineRoutes);
app.use('/api/operators', operatorRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/products', productRoutes);
app.use('/api/production-records', productionRecordRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/app-settings', appSettingsRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/department-roles', departmentRoleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/planning', planningRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const clientDistPath = path.resolve(__dirname, '../../client/dist');
const hasClientDist = fs.existsSync(clientDistPath) && fs.existsSync(path.join(clientDistPath, 'index.html'));

if (hasClientDist) {
  // Static assets with diagnostic logging and permissive headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url.includes('/assets/') || req.url.includes('favicon')) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Cache-Control', 'no-cache');
      logger.info(`[Static] Request: ${req.url} - IP: ${req.ip}`);
    }
    next();
  });

  app.use(express.static(clientDistPath, {
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
    }
  }));

  // SPA fallback (avoid swallowing API/health)
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl === '/health' || req.originalUrl.startsWith('/admin_debug')) return next();
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// 404 handler (API only)
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.originalUrl} does not exist` });
});

// 404 handler (non-API, when client build is missing)
if (!hasClientDist) {
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', message: `Route ${req.originalUrl} does not exist` });
  });
}

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.stack || err.message);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start the server
httpServer.listen(port, '0.0.0.0', () => {
  logger.info(`[server]: Server is running at http://0.0.0.0:${port} with Socket.io enabled`);
});
