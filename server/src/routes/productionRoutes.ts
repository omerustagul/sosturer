import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// GET All Routes
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const routes = await prisma.productionRoute.findMany({
      where: { companyId },
      include: {
        steps: {
          include: { operation: { include: { unit: true } } },
          orderBy: { sequence: 'asc' }
        },
        _count: { select: { products: true } }
      },
      orderBy: { displayOrder: 'asc' } as any
    });
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: 'Reçeteler getirilemedi' });
  }
});

// CREATE Route with Steps
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { name, code, description, steps } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const route = await tx.productionRoute.create({
        data: {
          companyId,
          name,
          code,
          description
        }
      });

      if (steps && Array.isArray(steps)) {
        await tx.routeStep.createMany({
          data: steps.map((s: any) => ({
            routeId: route.id,
            operationId: s.operationId,
            sequence: s.sequence,
            estimatedTime: s.estimatedTime
          }))
        });
      }

      return route;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Reçete oluşturulamadı' });
  }
});

// UPDATE Route with Steps
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { name, code, description, steps } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const route = await tx.productionRoute.update({
        where: { id: req.params.id as string, companyId },
        data: { name, code, description }
      });

      if (steps && Array.isArray(steps)) {
        await tx.routeStep.deleteMany({ where: { routeId: route.id } });
        await tx.routeStep.createMany({
          data: steps.map((s: any) => ({
            routeId: route.id,
            operationId: s.operationId,
            sequence: s.sequence,
            estimatedTime: s.estimatedTime
          }))
        });
      }

      return route;
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: 'Reçete güncellenemedi' });
  }
});

// DELETE Route
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.productionRoute.delete({
      where: { id: req.params.id as string, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Reçete silinemedi. Ürünlere bağlı olabilir.' });
  }
});

router.post('/reorder', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.productionRoute.update({
          where: { id, companyId },
          data: { displayOrder: index } as any
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
        const { company, createdAt, updatedAt, steps, ...rest } = originalData;
        return prisma.productionRoute.update({
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
    await prisma.productionRoute.deleteMany({
      where: { id: { in: ids }, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu silme başarısız oldu (bu reçeteye bağlı ürünler olabilir)' });
  }
});

router.post('/bulk-update-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids, status } = req.body;
    await prisma.productionRoute.updateMany({
      where: { id: { in: ids }, companyId },
      data: { status }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu durum güncelleme başarısız oldu' });
  }
});

export default router;
