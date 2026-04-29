import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// Stations Routes
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const stations = await prisma.station.findMany({
      where: { companyId },
      include: { unit: { select: { name: true, code: true } } },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: 'İstasyonlar getirilemedi' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID missing' });

    const lastItem = await prisma.station.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const station = await prisma.station.create({
      data: { ...req.body, companyId, displayOrder: req.body.displayOrder || nextOrder }
    });
    res.json(station);
  } catch (error) {
    res.status(400).json({ error: 'İstasyon oluşturulamadı' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const station = await prisma.station.update({
      where: { id: req.params.id as string, companyId },
      data: req.body
    });
    res.json(station);
  } catch (error) {
    res.status(400).json({ error: 'İstasyon güncellenemedi' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.station.delete({
      where: { id: req.params.id as string, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'İstasyon silinemedi' });
  }
});

router.post('/reorder', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    
    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.station.update({
          where: { id, companyId },
          data: { displayOrder: index }
        })
      )
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Sıralama güncellenemedi' });
  }
});

router.post('/bulk-update', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { updates } = req.body;
    
    await prisma.$transaction(
      updates.map((u: any) => {
        const { id, data: originalData } = u;
        const { unit, company, createdAt, updatedAt, ...rest } = originalData;
        return prisma.station.update({
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

router.post('/bulk-delete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    await prisma.station.deleteMany({
      where: { id: { in: ids }, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu silme başarısız oldu' });
  }
});

router.post('/bulk-update-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids, status } = req.body;
    await prisma.station.updateMany({
      where: { id: { in: ids }, companyId },
      data: { status }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu durum güncelleme başarısız oldu' });
  }
});

export default router;
