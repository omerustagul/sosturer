import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

const cleanPayload = (body: any) => ({
  code: body.code,
  name: body.name,
  notes: body.notes || null,
  status: body.status || 'active'
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const methods = await (prisma as any).measurementMethod.findMany({
      where: { companyId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(methods);
  } catch (error) {
    console.error('[MeasurementMethods] Fetch error:', error);
    res.status(500).json({ error: 'Olcum yontemleri getirilemedi' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    if (!req.body.code || !req.body.name) return res.status(400).json({ error: 'Kod ve ad zorunludur' });

    const lastItem = await (prisma as any).measurementMethod.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const method = await (prisma as any).measurementMethod.create({
      data: { ...cleanPayload(req.body), companyId, displayOrder: nextOrder }
    });
    res.status(201).json(method);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum yontemi olusturulamadi' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const existing = await (prisma as any).measurementMethod.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!existing) return res.status(404).json({ error: 'Olcum yontemi bulunamadi' });

    const method = await (prisma as any).measurementMethod.update({
      where: { id: req.params.id },
      data: cleanPayload(req.body)
    });
    res.json(method);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum yontemi guncellenemedi' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).measurementMethod.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Olcum yontemi silinemedi' });
  }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    await prisma.$transaction(ids.map((id: string, index: number) =>
      (prisma as any).measurementMethod.updateMany({
        where: { id, companyId },
        data: { displayOrder: index }
      })
    ));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Siralama kaydedilemedi' });
  }
});

router.post('/bulk-delete', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).measurementMethod.deleteMany({
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
    await (prisma as any).measurementMethod.updateMany({
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
      return (prisma as any).measurementMethod.updateMany({
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
