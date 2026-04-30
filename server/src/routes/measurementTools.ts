import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

const cleanTypePayload = (body: any) => ({
  code: body.code || null,
  name: body.name,
  brand: body.brand || null,
  model: body.model || null,
  notes: body.notes || null,
  status: body.status || 'active'
});

const getMeasurementMethodIds = (body: any) => {
  if (!Array.isArray(body.measurementMethodIds)) return [];
  const ids = body.measurementMethodIds.filter(Boolean).map((id: any) => String(id));
  return Array.from(new Set<string>(ids));
};

const hasMeasurementMethodSelection = (body: any) => Array.isArray(body.measurementMethodIds);

const methodInclude = {
  measurementMethod: { select: { id: true, code: true, name: true } }
};

const typeInclude = {
  methods: {
    include: methodInclude,
    orderBy: { id: 'asc' as const }
  }
};

const validateMeasurementMethods = async (tx: any, companyId: string, methodIds: string[]) => {
  if (methodIds.length === 0) return;
  const count = await tx.measurementMethod.count({
    where: {
      companyId,
      id: { in: methodIds }
    }
  });
  if (count !== methodIds.length) {
    throw new Error('Secilen olcum yontemlerinden biri bulunamadi');
  }
};

// GET /measurement-tools (now Types)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const types = await (prisma as any).measurementToolType.findMany({
      where: { companyId },
      include: typeInclude,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(types);
  } catch (error) {
    console.error('[MeasurementToolTypes] Fetch error:', error);
    res.status(500).json({ error: 'Olcum araci turleri getirilemedi' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const type = await (prisma as any).measurementToolType.findFirst({
      where: { id: req.params.id, companyId },
      include: typeInclude
    });
    if (!type) return res.status(404).json({ error: 'Olcum araci turu bulunamadi' });
    res.json(type);
  } catch (error) {
    res.status(500).json({ error: 'Olcum araci turu detayi getirilemedi' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    if (!req.body.name) return res.status(400).json({ error: 'Olcum araci turu adi zorunludur' });

    const lastItem = await (prisma as any).measurementToolType.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;
    const methodIds = getMeasurementMethodIds(req.body);

    const type = await prisma.$transaction(async (tx) => {
      await validateMeasurementMethods(tx as any, companyId, methodIds);
      const created = await (tx as any).measurementToolType.create({
        data: { ...cleanTypePayload(req.body), companyId, displayOrder: nextOrder }
      });
      if (methodIds.length > 0) {
        await (tx as any).measurementToolMethod.createMany({
          data: methodIds.map((measurementMethodId) => ({
            measurementToolTypeId: created.id,
            measurementMethodId
          }))
        });
      }
      return (tx as any).measurementToolType.findUnique({
        where: { id: created.id },
        include: typeInclude
      });
    });
    res.status(201).json(type);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum araci turu olusturulamadi' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const existing = await (prisma as any).measurementToolType.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!existing) return res.status(404).json({ error: 'Olcum araci turu bulunamadi' });
    const shouldUpdateMethods = hasMeasurementMethodSelection(req.body);
    const methodIds = getMeasurementMethodIds(req.body);

    const type = await prisma.$transaction(async (tx) => {
      if (shouldUpdateMethods) {
        await validateMeasurementMethods(tx as any, companyId, methodIds);
      }
      await (tx as any).measurementToolType.update({
        where: { id: req.params.id },
        data: cleanTypePayload(req.body)
      });
      if (shouldUpdateMethods) {
        await (tx as any).measurementToolMethod.deleteMany({
          where: { measurementToolTypeId: req.params.id }
        });
        if (methodIds.length > 0) {
          await (tx as any).measurementToolMethod.createMany({
            data: methodIds.map((measurementMethodId) => ({
              measurementToolTypeId: req.params.id,
              measurementMethodId
            }))
          });
        }
      }
      return (tx as any).measurementToolType.findUnique({
        where: { id: req.params.id },
        include: typeInclude
      });
    });
    res.json(type);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum araci turu guncellenemedi' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).measurementToolType.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Olcum araci turu silinemedi' });
  }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    await prisma.$transaction(ids.map((id: string, index: number) =>
      (prisma as any).measurementToolType.updateMany({
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
    await (prisma as any).measurementToolType.deleteMany({
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
    await (prisma as any).measurementToolType.updateMany({
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
      return (prisma as any).measurementToolType.updateMany({
        where: { id, companyId },
        data: cleanTypePayload(data)
      });
    }));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu guncelleme basarisiz oldu' });
  }
});

export default router;
