import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

const cleanPayload = (body: any) => ({
  code: body.code || null,
  name: body.name,
  description: body.description || null,
  status: body.status || 'active'
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const types = await (prisma as any).consumptionType.findMany({
      where: { companyId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(types);
  } catch (error) {
    console.error('[ConsumptionTypes] Fetch error:', error);
    res.status(500).json({ error: 'Tuketim tipleri getirilemedi' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    if (!req.body.name) return res.status(400).json({ error: 'Tip adi zorunludur' });

    const lastItem = await (prisma as any).consumptionType.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const type = await (prisma as any).consumptionType.create({
      data: { ...cleanPayload(req.body), companyId, displayOrder: nextOrder }
    });
    res.status(201).json(type);
  } catch (error: any) {
    console.error('[ConsumptionTypes] Create error:', error);
    res.status(400).json({ error: error.message || 'Tuketim tipi olusturulamadi' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const existing = await (prisma as any).consumptionType.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!existing) return res.status(404).json({ error: 'Tuketim tipi bulunamadi' });

    const type = await (prisma as any).consumptionType.update({
      where: { id: req.params.id },
      data: cleanPayload(req.body)
    });
    res.json(type);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Tuketim tipi guncellenemedi' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).consumptionType.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Tuketim tipi silinemedi' });
  }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'Gecersiz siralama' });

    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        (prisma as any).consumptionType.updateMany({
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
    await (prisma as any).consumptionType.deleteMany({
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
    await (prisma as any).consumptionType.updateMany({
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
      return (prisma as any).consumptionType.updateMany({
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
