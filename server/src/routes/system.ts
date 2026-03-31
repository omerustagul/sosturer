import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import os from 'os';

import bcrypt from 'bcryptjs';

const router = Router();

// 0. Sistem Bilgisi (Sürüm ve LAN IP)
router.get('/info', async (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';
    
    Object.keys(interfaces).forEach(name => {
      const ifaceGroup = interfaces[name] || [];
      const ipv4 = ifaceGroup.find(iface => iface.family === 'IPv4' && !iface.internal);
      if (ipv4) localIp = ipv4.address;
    });

    res.json({
      version: '1.0.4',
      ip: localIp,
      port: process.env.PORT || 3001,
      os: os.platform(),
      uptime: os.uptime()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DEBUG - Herkese açık şirket listesi (Hata ayıklama sonrası silinecek)
router.get('/debug_companies', async (_req, res) => {
  try {
    const companies = await prisma.company.findMany();
    res.json(companies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware: Sadece Super Admin erişebilir
const requireSuperAdmin = (req: AuthRequest, res: Response, next: any) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Bu işlem için Süper Yönetici yetkisi gereklidir.' });
  }
  next();
};

// 0.5 Tüm kullanıcıları listele (Global)
router.get('/users', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    console.log('[DEBUG] System Users fetch triggered by superadmin:', req.user?.email);
    const users = await prisma.user.findMany({
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    console.log('[DEBUG] Found users count:', users.length);
    res.json(users);
  } catch (error) {
    console.error('[ERROR] system/users fetch failed:', error);
    res.status(500).json({ error: 'Kullanıcılar listelenemedi' });
  }
});


// 0.6 Yeni kullanıcı oluştur (Global)
router.post('/users', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, fullName, password, role, companyId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        password: hashedPassword,
        role: role || 'user',
        companyId: companyId || null,
        status: 'active'
      }
    });
    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (error: any) {
    res.status(500).json({ error: 'Kullanıcı oluşturulamadı: ' + error.message });
  }
});

// 0.7 Kullanıcı güncelle (Global)
router.put('/users/:id', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, fullName, role, companyId, status, password } = req.body;

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (role !== undefined) updateData.role = role;
    if (companyId !== undefined) updateData.companyId = companyId;
    if (status !== undefined) updateData.status = status;
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }


    const user = await prisma.user.update({
      where: { id: id as string },
      data: updateData
    });

    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (error: any) {
    res.status(500).json({ error: 'Kullanıcı güncellenemedi: ' + error.message });
  }
});

// 0.8 Kullanıcı sil (Global)
router.delete('/users/:id', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: id as string } });
    res.json({ message: 'Kullanıcı silindi' });
  } catch (error: any) {
    res.status(500).json({ error: 'Kullanıcı silinemedi: ' + error.message });
  }
});



// 1. Tüm şirketleri listele
router.get('/companies', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        _count: { select: { users: true, productionRecords: true } },
        appSettings: true
      }
    });
    console.log('[DEBUG] Returning companies with user counts:', companies.map(c => ({ id: c.id, userCount: c._count.users })));
    res.json(companies);

  } catch (error) {
    res.status(500).json({ error: 'Şirketler listelenemedi' });
  }
});

// 2. Yeni şirket oluştur
router.post('/companies', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, sector } = req.body;
    
    // Find highest numeric ID to increment
    const lastCompany = await prisma.company.findFirst({
      orderBy: { id: 'desc' },
      where: { id: { not: { contains: '-' } } } // Exclude any UUIDs if they exist
    });

    let nextId = '260101';
    if (lastCompany && !isNaN(Number(lastCompany.id))) {
      nextId = String(Number(lastCompany.id) + 1);
    }

    const company = await prisma.company.create({
      data: { 
        id: nextId,
        name, 
        sector, 
        appSettings: {
          create: { theme: 'dark', language: 'tr' }
        }
      }
    });
    res.status(201).json(company);
  } catch (error) {
    console.error('Company creation failed:', error);
    res.status(500).json({ error: 'Şirket oluşturulamadı' });
  }
});

// 2.1 Şirketi güncelle
router.put('/companies/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, sector } = req.body;
    const company = await prisma.company.update({
      where: { id: id as string },
      data: { name, sector }
    });
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: 'Şirket güncellenemedi' });
  }
});

// 2.2 Şirketi sil (Tüm bağlı verilerle birlikte riskli işlem)
router.delete('/companies/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // Transaction ile güvenli silme yapılabilir ama şimdilik direkt siliyoruz (Prisma Cascade varsa siler)
    await prisma.company.delete({ where: { id: id as string } });
    res.json({ message: 'Şirket ve bağlı tüm veriler silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Şirket silinemedi. Bağlı veriler olabilir.' });
  }
});


// 3. Şirket verilerini izle (Görüntüleme Modu)
router.get('/companies/:id/stats', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const stats = {
      machines: await prisma.machine.count({ where: { companyId: id as string } }),
      operators: await prisma.operator.count({ where: { companyId: id as string } }),
      records: await prisma.productionRecord.count({ where: { companyId: id as string } }),
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'İstatistikler alınamadı' });
  }
});

// 5. Kullanıcıyı şirkete ata
router.post('/users/assign', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, companyId, role = 'admin' } = req.body;
    const user = await prisma.user.update({
      where: { email },
      data: { companyId, role }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Kullanıcı atanamadı' });
  }
});

// 4. Şirket Erişim Durumu (Görüntüleme vs Düzenleme)
router.get('/companies/:id/access', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { companyId: req.params.id as string } });
    res.json({ allowSupportAccess: settings?.allowSupportAccess || false });
  } catch (error) {
    res.status(500).json({ error: 'Erişim durumu alınamadı' });
  }
});

// 6. Son işlemleri getir (Bildirimler için)
router.get('/activity', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const activity = await prisma.auditLog.findMany({
      take: 20,
      orderBy: { changedAt: 'desc' }
    });
    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: 'İşlemler alınamadı' });
  }
});

// 6.1 Bildirimi okundu işaretle
router.put('/activity/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const log = await prisma.auditLog.update({
      where: { id: id as string },
      data: { isRead: true }
    });
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: 'Okundu işaretleme başarısız.' });
  }
});

// 6.2 Bildirimi sil
router.delete('/activity/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.auditLog.delete({ where: { id: id as string } });
    res.json({ success: true, message: 'Bildirim silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Bildirim silinemedi.' });
  }
});

// 6.3 Tüm bildirimleri okundu işaretle
router.put('/activity/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.auditLog.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Tümünü okundu işaretleme başarısız.' });
  }
});

// CATCH-ALL for /api/system
router.all('*', (req, res) => {
  console.log(`[DEBUG] Unmatched System Route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not Found', message: `System route ${req.originalUrl} not found` });
});

export default router;

