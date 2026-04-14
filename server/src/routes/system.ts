import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import os from 'os';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const router = Router();

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo_${Date.now()}${ext}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// 0.0 Upload Endpoint
router.post('/upload', authenticateToken, upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenemedi' });
    
    // Construct public URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') as string;
    const url = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

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

// 2.0 Şirket detayı getir
router.get('/companies/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = await prisma.company.findUnique({
      where: { id: id as string },
      include: {
        appSettings: true,
        _count: { select: { users: true, productionRecords: true, departments: true } }
      }
    });
    
    if (!company) {
      return res.status(404).json({ error: 'Şirket bulunamadı' });
    }
    
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: 'Şirket bilgisi alınamadı' });
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


// 2.3 Şirket Profili (Kendi şirketini yönetme)
router.get('/company-profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirkete bağlı değilsiniz' });

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: 'Profil bilgileri alınamadı' });
  }
});

router.put('/company-profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirkete bağlı değilsiniz' });

    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gereklidir.' });
    }

    const { id, createdAt, updatedAt, ...updateData } = req.body;
    
    const company = await prisma.company.update({
      where: { id: companyId },
      data: updateData
    });
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: 'Profil güncellenemedi' });
  }
});

// 2.4 Birimler ve Lokasyonlar (Units)
router.get('/company/locations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.json([]);

    const locations = await prisma.locations.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: 'asc' }
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Lokasyonlar yüklenemedi' });
  }
});

router.post('/company/locations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirket bulunamadı' });

    const location = await prisma.locations.create({
      data: {
        id: randomUUID(),
        company_id: companyId,
        name: req.body.name || 'Yeni Lokasyon',
        type: req.body.type || 'factory',
        address: req.body.address || '',
        phone: req.body.phone || null,
        email: req.body.email || null,
        is_main: !!req.body.is_main,
        working_hours: req.body.working_hours || null,
        location_code: req.body.location_code || null,
        operational_status: req.body.operational_status || 'active',
        opening_date: req.body.opening_date ? new Date(req.body.opening_date) : null,
        closure_date: req.body.closure_date ? new Date(req.body.closure_date) : null,
        contact_name: req.body.contact_name || null,
        notes: req.body.notes || null,
        floor_area_sqm: req.body.floor_area_sqm != null && req.body.floor_area_sqm !== '' ? Number(req.body.floor_area_sqm) : null,
        updated_at: new Date()
      }
    });

    res.json(location);
  } catch (error) {
    res.status(500).json({ error: 'Lokasyon oluşturulamadı' });
  }
});

router.put('/company/locations/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;
    if (!companyId) return res.status(400).json({ error: 'Şirket bulunamadı' });

    const location = await prisma.locations.update({
      where: { id: id as string },
      data: {
        name: req.body.name,
        type: req.body.type,
        address: req.body.address,
        phone: req.body.phone,
        email: req.body.email,
        is_main: req.body.is_main,
        working_hours: req.body.working_hours ?? null,
        location_code: req.body.location_code ?? undefined,
        operational_status: req.body.operational_status ?? undefined,
        opening_date: req.body.opening_date ? new Date(req.body.opening_date) : req.body.opening_date === null ? null : undefined,
        closure_date: req.body.closure_date ? new Date(req.body.closure_date) : req.body.closure_date === null ? null : undefined,
        contact_name: req.body.contact_name ?? undefined,
        notes: req.body.notes ?? undefined,
        floor_area_sqm: req.body.floor_area_sqm != null && req.body.floor_area_sqm !== '' ? Number(req.body.floor_area_sqm) : req.body.floor_area_sqm === null ? null : undefined,
        updated_at: new Date()
      }
    });

    res.json(location);
  } catch (error) {
    res.status(500).json({ error: 'Lokasyon güncellenemedi' });
  }
});

router.delete('/company/locations/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.locations.delete({ where: { id: id as string } });
    res.json({ message: 'Lokasyon silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Lokasyon silinemedi' });
  }
});

// 2.5 Şirket İzin Günleri (Off-days)
router.get('/company/off-days', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.json([]);

    const offDays = await prisma.$queryRawUnsafe(
      `SELECT * FROM company_off_days WHERE company_id = $1 ORDER BY date ASC`,
      companyId
    );
    res.json(offDays);
  } catch (error) {
    res.status(500).json({ error: 'İzin günleri yüklenemedi' });
  }
});

router.post('/company/off-days/toggle', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirket bulunamadı' });

    const { date, label } = req.body;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const existing: any = (await prisma.$queryRawUnsafe(
      `SELECT * FROM company_off_days WHERE company_id = $1 AND date = $2::timestamp LIMIT 1`,
      companyId,
      targetDate.toISOString()
    ) as any[])[0];

    if (existing) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM company_off_days WHERE id = $1`,
        existing.id
      );
      res.json({ action: 'deleted' });
    } else {
      const id = randomUUID();
      const created = await prisma.$executeRawUnsafe(
        `INSERT INTO company_off_days (id, company_id, date, label, created_at) VALUES ($1, $2, $3::timestamp, $4, NOW())`,
        id,
        companyId,
        targetDate.toISOString(),
        label || null
      );
      res.json({ action: 'created', data: { id, companyId, date: targetDate, label } });
    }
  } catch (error) {
    console.error('Off-day toggle failed:', error);
    res.status(500).json({ error: 'İşlem başarısız oldu' });
  }
});

router.get('/company/units', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.json([]);
    
    const unitsRaw = await prisma.department.findMany({
      where: { companyId },
      orderBy: { displayOrder: 'asc' }
    });
    const units = unitsRaw.map((unit) => {
      let locationId: string | null = null;
      try {
        if (unit.workingHours && unit.workingHours.trim().startsWith('{')) {
          const parsed = JSON.parse(unit.workingHours);
          locationId = parsed.locationId || null;
        }
      } catch {
        locationId = null;
      }
      return { ...unit, locationId };
    });
    res.json(units);
  } catch (error) {
    res.status(500).json({ error: 'Birimler yüklenemedi' });
  }
});

router.post('/company/units', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirket bulunamadı' });

    const { locationId, name, code, status, openingDate, notes, headcountPlanned, displayOrder } = req.body;
    const unit = await prisma.department.create({
      data: {
        name: name || 'Yeni Birim',
        code: code || null,
        status: status || 'active',
        openingDate: openingDate ? new Date(openingDate) : null,
        notes: notes || null,
        headcountPlanned: headcountPlanned != null && headcountPlanned !== '' ? Number(headcountPlanned) : null,
        displayOrder: displayOrder != null ? Number(displayOrder) : 0,
        workingHours: locationId ? JSON.stringify({ locationId }) : null,
        companyId
      }
    });
    let locationIdOut: string | null = null;
    try {
      if (unit.workingHours && String(unit.workingHours).trim().startsWith('{')) {
        locationIdOut = JSON.parse(String(unit.workingHours)).locationId || null;
      }
    } catch {
      locationIdOut = null;
    }
    res.json({ ...unit, locationId: locationIdOut });
  } catch (error) {
    res.status(500).json({ error: 'Birim oluşturulamadı' });
  }
});

router.put('/company/units/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { id: _i, createdAt, updatedAt, companyId, locationId, ...body } = req.body;
    const data: Record<string, unknown> = {
      name: body.name,
      code: body.code,
      status: body.status,
      notes: body.notes,
      headcountPlanned: body.headcountPlanned != null && body.headcountPlanned !== '' ? Number(body.headcountPlanned) : body.headcountPlanned === null ? null : undefined,
      displayOrder: body.displayOrder != null ? Number(body.displayOrder) : undefined,
      openingDate: body.openingDate ? new Date(body.openingDate) : body.openingDate === null ? null : undefined
    };
    if (locationId !== undefined) {
      data.workingHours = locationId ? JSON.stringify({ locationId }) : null;
    }
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    const unit = await prisma.department.update({
      where: { id: id as string },
      data: data as any
    });
    let locationIdOut: string | null = null;
    try {
      if (unit.workingHours && String(unit.workingHours).trim().startsWith('{')) {
        locationIdOut = JSON.parse(String(unit.workingHours)).locationId || null;
      }
    } catch {
      locationIdOut = null;
    }
    res.json({ ...unit, locationId: locationIdOut });
  } catch (error) {
    res.status(500).json({ error: 'Birim güncellenemedi' });
  }
});

router.post('/company/units/reorder', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { orders } = req.body;
    await prisma.$transaction(
      orders.map((item: any) =>
        prisma.department.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder }
        })
      )
    );
    res.json({ message: 'Sıralama güncellendi' });
  } catch (error) {
    res.status(500).json({ error: 'Sıralama güncellenemedi' });
  }
});

router.delete('/company/units/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id: id as string } });
    res.json({ message: 'Birim silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Birim silinemedi' });
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
    const companyId = req.user?.companyId;
    const activity = await prisma.auditLog.findMany({
      where: companyId ? { company_id: companyId } : {},
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
    const companyId = req.user?.companyId;
    await prisma.auditLog.updateMany({
      where: { 
        isRead: false,
        ...(companyId ? { company_id: companyId } : {})
      },
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

