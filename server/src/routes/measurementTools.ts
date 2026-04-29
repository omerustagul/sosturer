import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

const cleanToolPayload = (body: any) => ({
  code: body.code || null,
  name: body.name,
  serialNo: body.serialNo || null,
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

const methodInclude = {
  measurementMethod: { select: { id: true, code: true, name: true } }
};

const toolInclude = (includeLatestStatus = false) => ({
  methods: {
    include: methodInclude,
    orderBy: { id: 'asc' as const }
  },
  ...(includeLatestStatus ? {
    statuses: {
      include: statusInclude,
      orderBy: { createdAt: 'desc' as const },
      take: 1
    }
  } : {})
});

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

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);
    const includeLatest = req.query.includeLatest === 'true';

    const tools = await (prisma as any).measurementTool.findMany({
      where: { companyId },
      include: toolInclude(includeLatest),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(tools);
  } catch (error) {
    console.error('[MeasurementTools] Fetch error:', error);
    res.status(500).json({ error: 'Olcum araclari getirilemedi' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const tool = await (prisma as any).measurementTool.findFirst({
      where: { id: req.params.id, companyId },
      include: {
        methods: {
          include: methodInclude,
          orderBy: { id: 'asc' }
        },
        statuses: {
          include: statusInclude,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!tool) return res.status(404).json({ error: 'Olcum araci bulunamadi' });
    res.json(tool);
  } catch (error) {
    res.status(500).json({ error: 'Olcum araci detayi getirilemedi' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    if (!req.body.name) return res.status(400).json({ error: 'Olcum araci adi zorunludur' });

    const lastItem = await (prisma as any).measurementTool.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;
    const methodIds = getMeasurementMethodIds(req.body);

    const tool = await prisma.$transaction(async (tx) => {
      await validateMeasurementMethods(tx as any, companyId, methodIds);
      const created = await (tx as any).measurementTool.create({
        data: { ...cleanToolPayload(req.body), companyId, displayOrder: nextOrder }
      });
      if (methodIds.length > 0) {
        await (tx as any).measurementToolMethod.createMany({
          data: methodIds.map((measurementMethodId) => ({
            measurementToolId: created.id,
            measurementMethodId
          }))
        });
      }
      return (tx as any).measurementTool.findUnique({
        where: { id: created.id },
        include: toolInclude(false)
      });
    });
    res.status(201).json(tool);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum araci olusturulamadi' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const existing = await (prisma as any).measurementTool.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!existing) return res.status(404).json({ error: 'Olcum araci bulunamadi' });
    const shouldUpdateMethods = hasMeasurementMethodSelection(req.body);
    const methodIds = getMeasurementMethodIds(req.body);

    const tool = await prisma.$transaction(async (tx) => {
      if (shouldUpdateMethods) {
        await validateMeasurementMethods(tx as any, companyId, methodIds);
      }
      await (tx as any).measurementTool.update({
        where: { id: req.params.id },
        data: cleanToolPayload(req.body)
      });
      if (shouldUpdateMethods) {
        await (tx as any).measurementToolMethod.deleteMany({
          where: { measurementToolId: req.params.id }
        });
        if (methodIds.length > 0) {
          await (tx as any).measurementToolMethod.createMany({
            data: methodIds.map((measurementMethodId) => ({
              measurementToolId: req.params.id,
              measurementMethodId
            }))
          });
        }
      }
      return (tx as any).measurementTool.findUnique({
        where: { id: req.params.id },
        include: toolInclude(false)
      });
    });
    res.json(tool);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum araci guncellenemedi' });
  }
});

router.post('/:id/statuses', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const tool = await (prisma as any).measurementTool.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!tool) return res.status(404).json({ error: 'Olcum araci bulunamadi' });

    if (req.body.workCenterId) {
      const workCenter = await prisma.department.findFirst({
        where: { id: req.body.workCenterId, companyId },
        select: { id: true }
      });
      if (!workCenter) return res.status(400).json({ error: 'Secilen is merkezi bulunamadi' });
    }

    const status = await (prisma as any).measurementToolStatus.create({
      data: {
        ...cleanStatusPayload(req.body, req.user?.fullName || req.user?.email),
        companyId,
        measurementToolId: req.params.id
      },
      include: statusInclude
    });
    res.status(201).json(status);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum araci durumu kaydedilemedi' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).measurementTool.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Olcum araci silinemedi' });
  }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    await prisma.$transaction(ids.map((id: string, index: number) =>
      (prisma as any).measurementTool.updateMany({
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
    await (prisma as any).measurementTool.deleteMany({
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
    await (prisma as any).measurementTool.updateMany({
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
      return (prisma as any).measurementTool.updateMany({
        where: { id, companyId },
        data: cleanToolPayload(data)
      });
    }));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu guncelleme basarisiz oldu' });
  }
});

export default router;
