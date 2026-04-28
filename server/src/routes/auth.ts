import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendResetCode, sendTwoFactorCode } from '../lib/email';
import { getRequestIp, isIpAllowed, parseAllowedIpList } from '../utils/securitySettings';


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

    const appSettings = user.companyId
      ? await prisma.appSettings.findUnique({ where: { companyId: user.companyId } })
      : null;

    if (appSettings?.ipRestrictionEnabled) {
      const requestIp = getRequestIp(req);
      const allowedIps = parseAllowedIpList((appSettings as any).allowed_ip_list);

      if (!isIpAllowed(requestIp, allowedIps)) {
        return res.status(403).json({ error: 'Bu IP adresinden giriş yapılmasına izin verilmiyor.' });
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });

    if (appSettings?.twoFactorEnabled) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 5 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          two_factor_code: code,
          two_factor_expires: expires
        }
      });

      const sent = await sendTwoFactorCode(email, code);
      if (!sent) {
        return res.status(500).json({ error: 'Doğrulama kodu e-posta ile gönderilemedi. SMTP ayarlarını kontrol edin.' });
      }

      const twoFactorToken = jwt.sign(
        { id: user.id, email: user.email, companyId: user.companyId, purpose: '2fa' },
        JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.json({
        twoFactorRequired: true,
        twoFactorToken,
        message: 'Doğrulama kodu e-posta adresinize gönderildi.'
      });
    }

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

router.post('/login/verify-2fa', async (req: Request, res: Response): Promise<any> => {
  const { twoFactorToken, code } = req.body;

  if (!twoFactorToken || !code) {
    return res.status(400).json({ error: 'Doğrulama kodu zorunludur.' });
  }

  try {
    const payload = jwt.verify(twoFactorToken, JWT_SECRET) as any;
    if (payload.purpose !== '2fa') {
      return res.status(403).json({ error: 'Geçersiz doğrulama isteği.' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'Kullanıcı doğrulanamadı.' });
    }

    if (!user.two_factor_code || user.two_factor_code !== String(code).trim()) {
      return res.status(400).json({ error: 'Doğrulama kodu hatalı.' });
    }

    if (!user.two_factor_expires || user.two_factor_expires < new Date()) {
      return res.status(400).json({ error: 'Doğrulama kodunun süresi dolmuş.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        two_factor_code: null,
        two_factor_expires: null
      }
    });

    const token = makeToken(user);
    const { password: _, ...safeUser } = user;

    let company = null;
    if (user.companyId) {
      company = await prisma.company.findUnique({ where: { id: user.companyId } });
    }

    res.json({ token, user: safeUser, company });
  } catch (error) {
    res.status(403).json({ error: 'Doğrulama oturumu geçersiz veya süresi dolmuş.' });
  }
});

// ==========================================
// REGISTER (Step 1 & 2 & 3 Onboarding)
// ==========================================
router.post('/register', async (req: Request, res: Response): Promise<any> => {
  const { 
    email, password, fullName, phone, tc, personalAddress,
    companyName, taxNumber, taxOffice, companyPhone, companyAddress, city, district, country,
    role = 'admin' 
  } = req.body;

  try {
    if (!email || !password || !fullName || !companyName) {
      return res.status(400).json({ error: 'Zorunlu alanlar eksik' });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const { v4: uuidv4 } = require('uuid');
    
    // Şirket ve kullanıcıyı transaction ile oluştur
    const newCompanyId = uuidv4();
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          id: newCompanyId,
          name: companyName,
          companyAddress: companyAddress,
          taxNumber: taxNumber,
          taxOffice: taxOffice,
          companyPhone: companyPhone,
          city: city,
          district: district,
          country: country || 'Türkiye'
        }
      });
      
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          fullName,
          role: 'admin',
          personalPhone: phone,
          tc: tc,
          personalAddress: personalAddress,
          status: 'active',
          companyId: company.id
        }
      });

      // Default AppSettings oluştur
      await tx.appSettings.create({
        data: {
          companyId: company.id,
          theme: 'dark',
          language: 'tr'
        }
      });
      
      return { user, company };
    });

    const user = result.user;
    const token = makeToken(user);

    res.status(201).json({
      message: 'Kayıt başarılı',
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      company: result.company
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Kayıt işlemi sırasında bir hata oluştu.' });
  }
});

// ==========================================
// ME - Kendi profilini getir
// ==========================================
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
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

// ==========================================
// PASSWORD RECOVERY FLOW
// ==========================================

// Step 1: Send OTP
router.post('/forgot-password', async (req: Request, res: Response): Promise<any> => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı' });

    // Anti-spam: Check if a code was sent recently (last 60 seconds)
    // Code expires in 120s. If expires - now > 60s, it means it was sent less than 60s ago.
    if (user.reset_password_expires && (user.reset_password_expires.getTime() - Date.now() > 60000)) {
      return res.status(429).json({ error: 'Lütfen yeni bir kod istemeden önce 60 saniye bekleyin.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
    const expires = new Date(Date.now() + 120 * 1000); // 120 seconds expiry

    await prisma.user.update({
      where: { email },
      data: {
        reset_password_code: code,
        reset_password_expires: expires
      }
    });

    const sent = await sendResetCode(email, code);
    if (!sent) {
      return res.status(500).json({ error: 'E-posta gönderilemedi. Lütfen sistem yöneticisine başvurun.' });
    }

    res.json({ message: 'Doğrulama kodu e-posta adresinize gönderildi.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'İşlem başarısız' });
  }
});

// Step 2: Verify OTP
router.post('/verify-otp', async (req: Request, res: Response): Promise<any> => {
  const { email, code } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.reset_password_code !== code) {
      return res.status(400).json({ error: 'Geçersiz doğrulama kodu' });
    }

    if (!user.reset_password_expires || user.reset_password_expires < new Date()) {
      return res.status(400).json({ error: 'Doğrulama kodunun süresi dolmuş' });
    }

    // Masked info for step 3
    const mask = (str: string | null, type: 'phone' | 'name') => {
      if (!str) return '***';
      if (type === 'phone') {
        return str.substring(0, 4) + ' *** ** ' + str.substring(str.length - 2);
      }
      const parts = str.split(' ');
      return parts.map(p => p[0] + '****').join(' ');
    };

    res.json({
      message: 'Kod doğrulandı',
      maskedPhone: mask(user.personalPhone, 'phone'),
      maskedName: mask(user.fullName, 'name')
    });
  } catch (error) {
    res.status(500).json({ error: 'Sistem hatası' });
  }
});

// Step 3: Verify Secondary Data
router.post('/verify-secondary', async (req: Request, res: Response): Promise<any> => {
  const { email, code, fullName, phone } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.reset_password_code !== code) return res.status(400).json({ error: 'İşlem yetkisiz' });

    const phoneMatch = !user.personalPhone || user.personalPhone.replace(/\s/g, '') === phone.replace(/\s/g, '');
    const nameMatch = user.fullName.toLowerCase() === fullName.toLowerCase();

    if (!phoneMatch || !nameMatch) {
      return res.status(400).json({ error: 'Girdiğiniz bilgiler eşleşmiyor' });
    }

    res.json({ message: 'Kimlik doğrulandı' });
  } catch (error) {
    res.status(500).json({ error: 'Sistem hatası' });
  }
});

// Step 4: Reset Password
router.post('/reset-password', async (req: Request, res: Response): Promise<any> => {
  const { email, code, fullName, phone, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.reset_password_code !== code) return res.status(400).json({ error: 'İşlem yetkisiz' });

    // Re-verify secondary to be safe
    const phoneMatch = !user.personalPhone || user.personalPhone.replace(/\s/g, '') === phone.replace(/\s/g, '');
    const nameMatch = user.fullName.toLowerCase() === fullName.toLowerCase();

    if (!phoneMatch || !nameMatch) return res.status(400).json({ error: 'Yetkisiz şifre sıfırlama denemesi' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        reset_password_code: null,
        reset_password_expires: null,
        password_changed_at: new Date()
      }
    });

    res.json({ message: 'Şifreniz başarıyla güncellendi' });
  } catch (error) {
    res.status(500).json({ error: 'Sistem hatası' });
  }
});


export default router;
