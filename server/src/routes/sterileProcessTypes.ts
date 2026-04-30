import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId;

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const types = await prisma.sterileProcessType.findMany({
      where: { companyId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Steril işlem tipleri getirilemedi' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID missing' });

    const { code, name, description, status, notes, displayOrder } = req.body;

    const lastItem = await prisma.sterileProcessType.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const type = await prisma.sterileProcessType.create({
      data: {
        companyId,
        code,
        name,
        description,
        status: status || 'active',
        notes,
        displayOrder: displayOrder ?? nextOrder
      }
    });
    res.json(type);
  } catch (error) {
    console.error('[SterileProcessType] Create error:', error);
    res.status(400).json({ error: 'Steril işlem tipi oluşturulamadı' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { code, name, description, status, notes, displayOrder } = req.body;

    const type = await prisma.sterileProcessType.update({
      where: { id: req.params.id as string, companyId },
      data: {
        code,
        name,
        description,
        status,
        notes,
        displayOrder
      }
    });
    res.json(type);
  } catch (error) {
    console.error('[SterileProcessType] Update error:', error);
    res.status(400).json({ error: 'Steril işlem tipi güncellenemedi' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.sterileProcessType.delete({
      where: { id: req.params.id as string, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Steril işlem tipi silinemedi' });
  }
});

router.post('/reorder', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.sterileProcessType.update({
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

export default router;
