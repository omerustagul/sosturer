import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

const cleanEquipmentPayload = (body: any) => ({
  code: body.code || null,
  name: body.name,
  serialNo: body.serialNo || null,
  brand: body.brand || null,
  model: body.model || null,
  notes: body.notes || null,
  status: body.status || 'active'
});

const cleanStatusPayload = (body: any, createdBy?: string) => ({
  workCenterId: body.workCenterId || null,
  validUntil: body.validUntil ? new Date(body.validUntil) : null,
  negativeTolerance: body.negativeTolerance === '' || body.negativeTolerance == null ? null : Number(body.negativeTolerance),
  positiveTolerance: body.positiveTolerance === '' || body.positiveTolerance == null ? null : Number(body.positiveTolerance),
  certificate: body.certificate || null,
  operationStatus: body.operationStatus || 'available',
  notes: body.notes || null,
  createdBy: createdBy || null
});

const statusInclude = {
  workCenter: { select: { id: true, name: true, code: true } }
};

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);
    const includeLatest = req.query.includeLatest === 'true';

    const equipment = await (prisma as any).equipment.findMany({
      where: { companyId },
      ...(includeLatest ? {
        include: {
          statuses: {
            include: statusInclude,
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      } : {}),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(equipment);
  } catch (error) {
    console.error('[Equipment] Fetch error:', error);
    res.status(500).json({ error: 'Ekipmanlar getirilemedi' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const equipment = await (prisma as any).equipment.findFirst({
      where: { id: req.params.id, companyId },
      include: {
        statuses: {
          include: statusInclude,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!equipment) return res.status(404).json({ error: 'Ekipman bulunamadi' });
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: 'Ekipman detayi getirilemedi' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    if (!req.body.name) return res.status(400).json({ error: 'Ekipman adi zorunludur' });

    const lastItem = await (prisma as any).equipment.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const equipment = await (prisma as any).equipment.create({
      data: { ...cleanEquipmentPayload(req.body), companyId, displayOrder: nextOrder }
    });
    res.status(201).json(equipment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Ekipman olusturulamadi' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const existing = await (prisma as any).equipment.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!existing) return res.status(404).json({ error: 'Ekipman bulunamadi' });

    const equipment = await (prisma as any).equipment.update({
      where: { id: req.params.id },
      data: cleanEquipmentPayload(req.body)
    });
    res.json(equipment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Ekipman guncellenemedi' });
  }
});

router.post('/:id/statuses', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const equipment = await (prisma as any).equipment.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!equipment) return res.status(404).json({ error: 'Ekipman bulunamadi' });

    if (req.body.workCenterId) {
      const workCenter = await prisma.department.findFirst({
        where: { id: req.body.workCenterId, companyId },
        select: { id: true }
      });
      if (!workCenter) return res.status(400).json({ error: 'Secilen is merkezi bulunamadi' });
    }

    const status = await (prisma as any).equipmentStatus.create({
      data: {
        ...cleanStatusPayload(req.body, req.user?.fullName || req.user?.email),
        companyId,
        equipmentId: req.params.id
      },
      include: statusInclude
    });
    res.status(201).json(status);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Ekipman durumu kaydedilemedi' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).equipment.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Ekipman silinemedi' });
  }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    await prisma.$transaction(ids.map((id: string, index: number) =>
      (prisma as any).equipment.updateMany({
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
    await (prisma as any).equipment.deleteMany({
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
    await (prisma as any).equipment.updateMany({
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
      return (prisma as any).equipment.updateMany({
        where: { id, companyId },
        data: cleanEquipmentPayload(data)
      });
    }));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu guncelleme basarisiz oldu' });
  }
});

export default router;
