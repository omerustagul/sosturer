import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// Operations Routes
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const operations = await prisma.operation.findMany({
      where: { companyId },
      include: { 
        unit: { select: { name: true } },
        station: { select: { name: true, code: true } }
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(operations);
  } catch (error) {
    res.status(500).json({ error: 'Operasyonlar getirilemedi' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID missing' });

    const lastItem = await prisma.operation.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const op = await prisma.operation.create({
      data: { ...req.body, companyId, displayOrder: req.body.displayOrder || nextOrder }
    });
    res.json(op);
  } catch (error) {
    res.status(400).json({ error: 'Operasyon oluşturulamadı' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const op = await prisma.operation.update({
      where: { id: req.params.id as string, companyId },
      data: req.body
    });
    res.json(op);
  } catch (error) {
    res.status(400).json({ error: 'Operasyon güncellenemedi' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.operation.delete({
      where: { id: req.params.id as string, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Operasyon silinemedi' });
  }
});

router.post('/reorder', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.operation.update({
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

router.post('/bulk-update', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { updates } = req.body;
    
    await prisma.$transaction(
      updates.map((u: any) => {
        const { id, data: originalData } = u;
        const { unit, station, company, createdAt, updatedAt, ...rest } = originalData;
        return prisma.operation.update({
          where: { id, companyId },
          data: rest
        });
      })
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu güncelleme başarısız oldu' });
  }
});

router.post('/bulk-delete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    await prisma.operation.deleteMany({
      where: { id: { in: ids }, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu silme başarısız oldu' });
  }
});

router.post('/bulk-update-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids, status } = req.body;
    await prisma.operation.updateMany({
      where: { id: { in: ids }, companyId },
      data: { status }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu durum güncelleme başarısız oldu' });
  }
});

// Product Recipe Routes
router.get('/recipes/:productId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const recipes = await prisma.productRecipe.findMany({
      where: { productId: req.params.productId as string },
      include: { operation: true },
      orderBy: { sequence: 'asc' }
    });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Reçete getirilemedi' });
  }
});

router.post('/recipes/bulk', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { productId, recipes } = req.body;
    await prisma.$transaction([
      prisma.productRecipe.deleteMany({ where: { productId } }),
      prisma.productRecipe.createMany({
        data: recipes.map((r: any) => ({
          productId,
          operationId: r.operationId,
          sequence: r.sequence,
          estimatedTime: r.estimatedTime
        }))
      })
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Reçete kaydedilemedi' });
  }
});

export default router;
