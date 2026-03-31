import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'gizli-super-secret-key-123';

function makeToken(user: any) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.fullName, companyId: user.companyId },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// DEBUG - Kullanıcı bilgilerini getir (Hata ayıklama sonrası silinecek)
router.get('/debug_user/:email', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { email: req.params.email as string },
      include: { company: true }
    });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// LOGIN
// ==========================================
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Hesabınız pasif duruma getirilmiştir' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });

    const token = makeToken(user);
    const { password: _, ...safeUser } = user;

    // Şirket bilgisini de ekle
    let company = null;
    if (user.companyId) {
      company = await prisma.company.findUnique({ where: { id: user.companyId } });
    }

    res.json({ token, user: safeUser, company });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sunucu hatası. Giriş yapılamadı.' });
  }
});

// ==========================================
// REGISTER (Herkes kayıt olabilir - şirketsiz)
// ==========================================
router.post('/register', async (req: Request, res: Response): Promise<any> => {
  const { email, password, fullName, role = 'user', phone, ...otherData } = req.body;
  try {
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'E-posta, şifre ve ad soyad zorunludur' });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor' });

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user with explicit whitelist to avoid Prisma errors on unknown fields
    const user = await prisma.user.create({
      data: { 
        email, 
        password: hashedPassword, 
        fullName, 
        role: 'user', 
        personalPhone: phone,
        status: 'active'
      }
    });

    const token = makeToken(user);
    res.status(201).json({
      message: 'Kullanıcı oluşturuldu',
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Kullanıcı oluşturulamadı.' });
  }
});

// ==========================================
// ME - Kendi profilini getir
// ==========================================
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    const { password, ...safeUser } = user;

    let company = null;
    if (user.companyId) {
      company = await prisma.company.findUnique({ where: { id: user.companyId } });
    }

    const freshToken = makeToken(user);
    res.json({ ...safeUser, company, token: freshToken });
  } catch (error) {
    res.status(500).json({ error: 'Profil bilgileri alınamadı' });
  }
});

// ==========================================
// ME - Kişisel profil güncelle (şirket alanları buraya gelmiyor)
// ==========================================
router.put('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { id, email, password, role, companyId, ...updateData } = req.body;
    const user = await prisma.user.update({ where: { id: req.user.id }, data: updateData });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Profil güncellenemedi' });
  }
});

// ==========================================
// COMPANY - Şirket bilgilerini getir
// ==========================================
router.get('/company', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    if (!req.user.companyId) return res.status(404).json({ error: 'Şirkete bağlı değilsiniz' });
    const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: 'Şirket bilgisi alınamadı' });
  }
});

// ==========================================
// COMPANY - Şirket bilgilerini güncelle (sadece admin)
// ==========================================
router.put('/company', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    if (!req.user.companyId) return res.status(400).json({ error: 'Şirkete bağlı değilsiniz' });
    const { id, createdAt, ...updateData } = req.body;
    const company = await prisma.company.update({ where: { id: req.user.companyId }, data: updateData });
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: 'Şirket güncellenemedi' });
  }
});

// ==========================================
// COMPANY USERS - Şirketteki kullanıcıları listele (sadece admin)
// ==========================================
router.get('/company/users', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.user.companyId },
      select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true, avatarUrl: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Kullanıcılar listelenemedi' });
  }
});

// ==========================================
// COMPANY USERS - Şirkete yeni kullanıcı davet et / ekle (sadece admin)
// ==========================================
router.post('/company/users', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { email, password, fullName, role = 'user' } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'E-posta, şifre ve ad soyad zorunludur' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Kullanıcı zaten varsa aynı şirkete ata
      if (existing.companyId === req.user.companyId) {
        return res.status(400).json({ error: 'Bu kullanıcı zaten şirketinizde kayıtlı' });
      }
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { companyId: req.user.companyId, role },
        select: { id: true, email: true, fullName: true, role: true, status: true }
      });
      return res.json({ message: 'Mevcut kullanıcı şirketinize eklendi', user: updated });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { email, password: hashedPassword, fullName, role, companyId: req.user.companyId },
      select: { id: true, email: true, fullName: true, role: true, status: true }
    });
    res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu ve şirkete eklendi', user: newUser });
  } catch (error) {
    console.error('Add company user error:', error);
    res.status(500).json({ error: 'Kullanıcı eklenemedi' });
  }
});

// ==========================================
// COMPANY USERS - Kullanıcı rolü / durumu güncelle (sadece admin)
// ==========================================
router.put('/company/users/:userId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const { role, status } = req.body;

    // Kullanıcının bu şirkete ait olduğunu doğrula
    const target = await prisma.user.findUnique({ where: { id: userId as string } });
    if (!target || target.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    // Kendini düzenlemesini engelle
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Kendi hesabınızı bu yolda düzenleyemezsiniz' });
    }

    const updated = await prisma.user.update({
      where: { id: userId as string },
      data: { ...(role && { role }), ...(status && { status }) },
      select: { id: true, email: true, fullName: true, role: true, status: true }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Kullanıcı güncellenemedi' });
  }
});

// ==========================================
// COMPANY USERS - Kullanıcıyı şirketten çıkar (sadece admin)
// ==========================================
router.delete('/company/users/:userId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) return res.status(400).json({ error: 'Kendinizi silemezsiniz' });

    const target = await prisma.user.findUnique({ where: { id: userId as string } });
    if (!target || target.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    await prisma.user.delete({ where: { id: userId as string } });
    res.json({ message: 'Kullanıcı silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Kullanıcı silinemedi' });
  }
});

export default router;
