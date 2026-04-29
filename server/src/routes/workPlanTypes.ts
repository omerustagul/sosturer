import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const types = await prisma.workPlanType.findMany({
      where: { companyId },
      include: { operation: { select: { id: true, name: true, code: true } } },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Liste türleri getirilemedi' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID missing' });

    const lastItem = await prisma.workPlanType.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const type = await prisma.workPlanType.create({
      data: { ...req.body, companyId, displayOrder: nextOrder }
    });
    res.json(type);
  } catch (error) {
    res.status(400).json({ error: 'Liste türü oluşturulamadı' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const type = await prisma.workPlanType.update({
      where: { id: req.params.id as string, companyId },
      data: req.body
    });
    res.json(type);
  } catch (error) {
    res.status(400).json({ error: 'Liste türü güncellenemedi' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.workPlanType.delete({
      where: { id: req.params.id as string, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Liste türü silinemedi' });
  }
});

export default router;
