import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

const cleanPayload = (body: any) => ({
  code: body.code || null,
  name: body.name,
  status: body.status || 'active'
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const reasons = await prisma.downtimeReason.findMany({
      where: { companyId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(reasons);
  } catch (error) {
    console.error('[DowntimeReasons] Fetch error:', error);
    res.status(500).json({ error: 'Duruş sebepleri getirilemedi' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    if (!req.body.name) return res.status(400).json({ error: 'Sebep adi zorunludur' });

    const lastItem = await prisma.downtimeReason.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const reason = await prisma.downtimeReason.create({
      data: { ...cleanPayload(req.body), companyId, displayOrder: nextOrder }
    });
    res.status(201).json(reason);
  } catch (error: any) {
    console.error('[DowntimeReasons] Create error:', error);
    res.status(400).json({ error: error.message || 'Duruş sebebi olusturulamadi' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const existing = await prisma.downtimeReason.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!existing) return res.status(404).json({ error: 'Duruş sebebi bulunamadi' });

    const reason = await prisma.downtimeReason.update({
      where: { id: req.params.id },
      data: cleanPayload(req.body)
    });
    res.json(reason);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Duruş sebebi guncellenemedi' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.downtimeReason.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Duruş sebebi silinemedi' });
  }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'Gecersiz siralama' });

    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.downtimeReason.updateMany({
          where: { id, companyId },
          data: { displayOrder: index }
        })
      )
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Siralama kaydedilemedi' });
  }
});

router.post('/bulk-delete', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.downtimeReason.deleteMany({
      where: { id: { in: req.body.ids || [] }, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu silme basarisiz oldu' });
  }
});

router.post('/bulk-update-status', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.downtimeReason.updateMany({
      where: { id: { in: req.body.ids || [] }, companyId },
      data: { status: req.body.status }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu durum guncelleme basarisiz oldu' });
  }
});

router.post('/bulk-update', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
    await prisma.$transaction(updates.map((update: any) => {
      const { id, data } = update;
      return prisma.downtimeReason.updateMany({
        where: { id, companyId },
        data: cleanPayload(data)
      });
    }));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu guncelleme basarisiz oldu' });
  }
});

export default router;
