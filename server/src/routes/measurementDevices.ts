import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

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
  certificateDocumentUrl: body.certificateDocumentUrl || null,
  certificateDocumentName: body.certificateDocumentName || null,
  operationStatus: body.operationStatus || 'available',
  notes: body.notes || null,
  createdBy: createdBy || null
});

const statusInclude = {
  workCenter: { select: { id: true, name: true, code: true } }
};

const deviceInclude = (includeLatestStatus = false) => ({
  type: { select: { id: true, name: true, brand: true, model: true } },
  ...(includeLatestStatus ? {
    statuses: {
      include: statusInclude,
      orderBy: { createdAt: 'desc' as const },
      take: 1
    }
  } : {})
});

const certificateUploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/measurement-certificates');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const safeName = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `measurement_certificate_${Date.now()}_${safeName}.pdf`);
  }
});

const certificateUpload = multer({
  storage: certificateUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';
    if (!isPdf) return cb(new Error('Sadece PDF dosyasi yuklenebilir'));
    cb(null, true);
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);
    const includeLatest = req.query.includeLatest === 'true';

    const devices = await (prisma as any).measurementDevice.findMany({
      where: { companyId },
      include: deviceInclude(includeLatest),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(devices);
  } catch (error) {
    console.error('[MeasurementDevices] Fetch error:', error);
    res.status(500).json({ error: 'Olcum cihazlari getirilemedi' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const device = await (prisma as any).measurementDevice.findFirst({
      where: { id: req.params.id, companyId },
      include: {
        type: true,
        statuses: {
          include: statusInclude,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!device) return res.status(404).json({ error: 'Olcum cihazi bulunamadi' });
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Olcum cihazi detayi getirilemedi' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    if (!req.body.typeId) return res.status(400).json({ error: 'Olcum araci turu secilmelidir' });

    const lastItem = await (prisma as any).measurementDevice.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const device = await (prisma as any).measurementDevice.create({
      data: { ...cleanDevicePayload(req.body), companyId, displayOrder: nextOrder },
      include: deviceInclude(false)
    });
    res.status(201).json(device);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum cihazi olusturulamadi' });
  }
});

router.post('/certificates/upload', (req: AuthRequest, res) => {
  certificateUpload.single('file')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Belge yuklenemedi' });
    if (!req.file) return res.status(400).json({ error: 'Belge yuklenemedi' });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') as string;
    const url = `${protocol}://${host}/uploads/measurement-certificates/${req.file.filename}`;

    res.json({
      url,
      name: req.file.originalname,
      size: req.file.size
    });
  });
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const existing = await (prisma as any).measurementDevice.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!existing) return res.status(404).json({ error: 'Olcum cihazi bulunamadi' });

    const device = await (prisma as any).measurementDevice.update({
      where: { id: req.params.id },
      data: cleanDevicePayload(req.body),
      include: deviceInclude(false)
    });
    res.json(device);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum cihazi guncellenemedi' });
  }
});

router.post('/:id/statuses', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const device = await (prisma as any).measurementDevice.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true }
    });
    if (!device) return res.status(404).json({ error: 'Olcum cihazi bulunamadi' });

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
        measurementDeviceId: req.params.id
      },
      include: statusInclude
    });
    res.status(201).json(status);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Olcum cihazi durumu kaydedilemedi' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).measurementDevice.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Olcum cihazi silinemedi' });
  }
});

router.delete('/statuses/:statusId', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await (prisma as any).measurementToolStatus.deleteMany({
      where: { id: req.params.statusId, companyId }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Durum kaydi silinemedi' });
  }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    await prisma.$transaction(ids.map((id: string, index: number) =>
      (prisma as any).measurementDevice.updateMany({
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
    await (prisma as any).measurementDevice.deleteMany({
      where: { id: { in: req.body.ids || [] }, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu silme basarisiz oldu' });
  }
});

export default router;
