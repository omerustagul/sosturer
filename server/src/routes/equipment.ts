import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

const cleanEquipmentTypePayload = (body: any) => ({
  code: body.code || null,
  name: body.name,
  brand: body.brand || null,
  model: body.model || null,
  notes: body.notes || null,
  status: body.status || 'active'
});

const cleanDevicePayload = (body: any) => ({
  typeId: body.typeId,
  serialNo: body.serialNo || null,
  code: body.code || null,
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

// EQUIPMENT TYPE ROUTES (DEFINITIONS)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const equipmentTypes = await (prisma as any).equipmentType.findMany({
      where: { companyId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(equipmentTypes);
  } catch (error) {
    console.error('[EquipmentType] Fetch error:', error);
    res.status(500).json({ error: 'Ekipman türleri getirilemedi' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!req.body.name) return res.status(400).json({ error: 'Ekipman adı zorunludur' });

    const lastItem = await (prisma as any).equipmentType.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const equipmentType = await (prisma as any).equipmentType.create({
      data: { ...cleanEquipmentTypePayload(req.body), companyId, displayOrder: nextOrder }
    });
    res.status(201).json(equipmentType);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Ekipman türü oluşturulamadı' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const equipmentType = await (prisma as any).equipmentType.update({
      where: { id: req.params.id, companyId },
      data: cleanEquipmentTypePayload(req.body)
    });
    res.json(equipmentType);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Ekipman türü güncellenemedi' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).equipmentType.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Ekipman türü silinemedi' });
  }
});

// EQUIPMENT DEVICE ROUTES (INSTANCES)
router.get('/devices', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const devices = await (prisma as any).equipmentDevice.findMany({
      where: { companyId },
      include: {
        type: true,
        statuses: {
          include: statusInclude,
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Ekipmanlar getirilemedi' });
  }
});

router.post('/devices', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const lastItem = await (prisma as any).equipmentDevice.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const device = await (prisma as any).equipmentDevice.create({
      data: { ...cleanDevicePayload(req.body), companyId, displayOrder: nextOrder },
      include: { type: true }
    });
    res.status(201).json(device);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Ekipman oluşturulamadı' });
  }
});

router.put('/devices/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const device = await (prisma as any).equipmentDevice.update({
      where: { id: req.params.id, companyId },
      data: cleanDevicePayload(req.body),
      include: { type: true }
    });
    res.json(device);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Ekipman güncellenemedi' });
  }
});

router.delete('/devices/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).equipmentDevice.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Ekipman silinemedi' });
  }
});

// DEVICE STATUS ROUTES
router.post('/devices/:id/statuses', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const device = await (prisma as any).equipmentDevice.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!device) return res.status(404).json({ error: 'Ekipman bulunamadı' });

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
    res.status(400).json({ error: error.message || 'Durum kaydedilemedi' });
  }
});

router.delete('/statuses/:statusId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).equipmentStatus.deleteMany({
      where: { id: req.params.statusId, companyId }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Durum kaydı silinemedi' });
  }
});

// REORDER ROUTES
router.post('/reorder', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    await prisma.$transaction(ids.map((id: string, index: number) =>
      (prisma as any).equipmentType.updateMany({
        where: { id, companyId },
        data: { displayOrder: index }
      })
    ));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Sıralama kaydedilemedi' });
  }
});

export default router;
