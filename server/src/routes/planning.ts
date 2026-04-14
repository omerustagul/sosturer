import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

router.get('/requirements', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    // 1. Get all products
    const products = await prisma.product.findMany({
      where: { companyId, status: 'active' },
      select: { 
        id: true, 
        productCode: true, 
        productName: true, 
        cycleTimeSeconds: true,
        productGroup: true 
      }
    });

    // 2. Get stock levels per product
    const stockLevels = await prisma.stockLevel.groupBy({
      by: ['productId'],
      where: { companyId },
      _sum: { quantity: true }
    });

    // 3. Get pending order quantities per product
    const pendingOrders = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { 
        order: { 
          companyId, 
          status: { in: ['pending', 'preparing'] } 
        } 
      },
      _sum: { quantity: true }
    });

    // 4. Map them together
    const requirements = products.map(product => {
      const stock = stockLevels.find(s => s.productId === product.id)?._sum.quantity || 0;
      const ordered = pendingOrders.find(o => o.productId === product.id)?._sum.quantity || 0;
      const netRequirement = Math.max(0, ordered - stock);

      // Estimate production time (minutes)
      const estimatedProductionMinutes = (netRequirement * product.cycleTimeSeconds) / 60;

      return {
        ...product,
        stock,
        ordered,
        netRequirement,
        estimatedProductionMinutes
      };
    }).filter(r => r.ordered > 0 || r.stock > 0); // Only show relevant ones

    res.json(requirements);
  } catch (error) {
    console.error('Planning error:', error);
    res.status(500).json({ error: 'Planlama verileri hesaplanamadı' });
  }
});

router.get('/capacity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const machines = await prisma.machine.findMany({
      where: { companyId, status: 'active' },
      select: { id: true, name: true, code: true, capacityPerShift: true }
    });

    const shifts = await prisma.shift.findMany({
      where: { companyId, status: 'active' },
      select: { id: true, shiftName: true, durationMinutes: true }
    });

    // Total daily capacity in minutes
    const totalDailyCapacity = machines.length * shifts.reduce((acc, s) => acc + s.durationMinutes, 0);

    res.json({
      machines,
      shifts,
      totalDailyCapacity
    });
  } catch (error) {
    res.status(500).json({ error: 'Kapasite verileri getirilemedi' });
  }
});

// Production Planning Endpoints
router.get('/production', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { date } = req.query;
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const plans = await (prisma as any).productionPlan.findMany({
      where: { 
        companyId,
        planDate: date ? new Date(date as string) : undefined
      },
      include: {
        machine: { select: { code: true, name: true } },
        product: { select: { productCode: true, productName: true } },
        shift: { select: { shiftName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(plans);
  } catch (error) {
    console.error('Fetch plans error:', error);
    res.status(500).json({ error: 'Planlar getirilemedi' });
  }
});

router.post('/production', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { planDate, machineId, shiftId, productId, plannedQuantity, notes } = req.body;

    const plan = await (prisma as any).productionPlan.create({
      data: {
        companyId,
        planDate: new Date(planDate),
        machineId,
        shiftId,
        productId,
        plannedQuantity,
        notes
      }
    });

    res.json(plan);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Plan kaydedilemedi' });
  }
});

router.delete('/production/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    await (prisma as any).productionPlan.deleteMany({
      where: { 
        id: req.params.id,
        companyId 
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Plan silinemedi' });
  }
});

export default router;
