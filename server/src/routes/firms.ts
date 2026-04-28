import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId as string | undefined;

const firmSelect = {
  id: true,
  companyId: true,
  code: true,
  name: true,
  type: true,
  taxOffice: true,
  taxNumber: true,
  phone: true,
  email: true,
  address: true,
  contactName: true,
  notes: true,
  status: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true
};

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const firms = await (prisma as any).firm.findMany({
      where: { companyId },
      select: firmSelect,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]
    });

    res.json(firms);
  } catch (error: any) {
    console.error('[Firms] List error:', error);
    res.status(500).json({ error: 'Firmalar getirilemedi: ' + error.message });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Şirket bilgisi bulunamadı' });

    const firm = await (prisma as any).firm.create({
      data: {
        companyId,
        code: req.body.code || null,
        name: req.body.name,
        type: req.body.type || 'general',
        taxOffice: req.body.taxOffice || null,
        taxNumber: req.body.taxNumber || null,
        phone: req.body.phone || null,
        email: req.body.email || null,
        address: req.body.address || null,
        contactName: req.body.contactName || null,
        notes: req.body.notes || null,
        status: req.body.status || 'active',
        displayOrder: req.body.displayOrder || 0
      },
      select: firmSelect
    });

    res.status(201).json(firm);
  } catch (error: any) {
    console.error('[Firms] Create error:', error);
    res.status(500).json({ error: 'Firma oluşturulamadı: ' + error.message });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Şirket bilgisi bulunamadı' });

    const firm = await (prisma as any).firm.update({
      where: { id: req.params.id as string, companyId },
      data: {
        code: req.body.code !== undefined ? (req.body.code || null) : undefined,
        name: req.body.name,
        type: req.body.type,
        taxOffice: req.body.taxOffice !== undefined ? (req.body.taxOffice || null) : undefined,
        taxNumber: req.body.taxNumber !== undefined ? (req.body.taxNumber || null) : undefined,
        phone: req.body.phone !== undefined ? (req.body.phone || null) : undefined,
        email: req.body.email !== undefined ? (req.body.email || null) : undefined,
        address: req.body.address !== undefined ? (req.body.address || null) : undefined,
        contactName: req.body.contactName !== undefined ? (req.body.contactName || null) : undefined,
        notes: req.body.notes !== undefined ? (req.body.notes || null) : undefined,
        status: req.body.status,
        displayOrder: req.body.displayOrder !== undefined ? req.body.displayOrder : undefined
      },
      select: firmSelect
    });

    res.json(firm);
  } catch (error: any) {
    console.error('[Firms] Update error:', error);
    res.status(500).json({ error: 'Firma güncellenemedi: ' + error.message });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Şirket bilgisi bulunamadı' });

    await (prisma as any).firm.delete({
      where: { id: req.params.id as string, companyId }
    });

    res.json({ success: true, message: 'Firma silindi.' });
  } catch (error: any) {
    console.error('[Firms] Delete error:', error);
    res.status(500).json({ error: 'Firma silinemedi. Bu firma stok fişlerinde kullanılıyor olabilir.' });
  }
});

router.post('/reorder', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    if (!companyId) return res.status(400).json({ error: 'Şirket bilgisi bulunamadı' });
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'Geçersiz veri' });

    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        (prisma as any).firm.update({
          where: { id, companyId },
          data: { displayOrder: index }
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Sıralama güncellenemedi' });
  }
});

router.post('/bulk-update', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const { updates } = req.body;
    if (!companyId) return res.status(400).json({ error: 'Şirket bilgisi bulunamadı' });
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Geçersiz veri' });

    await prisma.$transaction(
      updates.map((u: any) => {
        const { id, data: originalData } = u;
        const { company, stockVouchers, createdAt, updatedAt, companyId: _companyId, ...rest } = originalData;
        return (prisma as any).firm.update({
          where: { id, companyId },
          data: rest
        });
      })
    );

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu güncelleme başarısız oldu' });
  }
});

router.post('/bulk-delete', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    if (!companyId) return res.status(400).json({ error: 'Şirket bilgisi bulunamadı' });

    await (prisma as any).firm.deleteMany({
      where: { id: { in: ids }, companyId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu silme başarısız oldu' });
  }
});

router.post('/bulk-update-status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const { ids, status } = req.body;
    if (!companyId) return res.status(400).json({ error: 'Şirket bilgisi bulunamadı' });

    await (prisma as any).firm.updateMany({
      where: { id: { in: ids }, companyId },
      data: { status }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu durum güncelleme başarısız oldu' });
  }
});

export default router;
