import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/overtime - Tüm mesai planlarını listele
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const plans = await prisma.overtimePlan.findMany({
      where: companyId ? { companyId } : undefined,
      include: {
        shift: { select: { shiftName: true, shiftCode: true } },
        items: {
          include: {
            machine: { select: { name: true, code: true } },
            backupMachine: { select: { name: true, code: true } },
            operator: { 
              select: { 
                fullName: true, 
                employeeId: true,
                department: { select: { name: true } }
              } 
            },
            product: { select: { productName: true, productCode: true } }
          }
        },
        _count: { select: { items: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(plans);
  } catch (error: any) {
    console.error('[Overtime] List error:', error);
    res.status(500).json({ error: 'Mesai planları getirilemedi: ' + error.message });
  }
});

// GET /api/overtime/reports/summary - Rapor özeti
router.get('/reports/summary', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { startDate, endDate, operatorId, machineId, productId, shiftId } = req.query;

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (startDate && endDate) {
      where.startDate = { gte: new Date(startDate as string) };
      where.endDate = { lte: new Date(endDate as string) };
    }
    if (shiftId) where.shiftId = shiftId;

    const itemWhere: any = {};
    if (operatorId) itemWhere.operatorId = operatorId;
    if (machineId) itemWhere.machineId = machineId;
    if (productId) itemWhere.productId = productId;

    const plans = await prisma.overtimePlan.findMany({
      where,
      include: {
        shift: { select: { shiftName: true } },
        items: {
          where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
          include: {
            machine: { select: { name: true, code: true } },
            operator: { select: { fullName: true, employeeId: true } },
            product: { select: { productName: true, productCode: true } }
          }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    // Compute aggregates
    const allItems = plans.flatMap(p => p.items);
    const uniqueOperators = [...new Set(allItems.map(i => i.operatorId))];
    const uniqueMachines = [...new Set(allItems.map(i => i.machineId).filter(Boolean))];
    const uniqueDates = [...new Set(allItems.map(i => new Date(i.date).toISOString().split('T')[0]))];

    // Operator frequency
    const operatorCounts: Record<string, { name: string; count: number }> = {};
    allItems.forEach(i => {
      if (!operatorCounts[i.operatorId]) operatorCounts[i.operatorId] = { name: i.operator.fullName, count: 0 };
      operatorCounts[i.operatorId].count++;
    });
    const topOperator = Object.values(operatorCounts).sort((a, b) => b.count - a.count)[0] || null;

    // Machine frequency
    const machineCounts: Record<string, { name: string; count: number }> = {};
    allItems.forEach(i => {
      if (!i.machineId || !i.machine) return;
      if (!machineCounts[i.machineId]) machineCounts[i.machineId] = { name: i.machine.name, count: 0 };
      machineCounts[i.machineId].count++;
    });
    const topMachine = Object.values(machineCounts).sort((a, b) => b.count - a.count)[0] || null;

    res.json({
      totalPlans: plans.length,
      totalDays: uniqueDates.length,
      totalOperators: uniqueOperators.length,
      totalMachines: uniqueMachines.length,
      topOperator,
      topMachine,
      plans
    });
  } catch (error: any) {
    console.error('[Overtime] Reports error:', error);
    res.status(500).json({ error: 'Mesai raporu oluşturulamadı: ' + error.message });
  }
});

// GET /api/overtime/:id - Tek plan detay
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const plan = await prisma.overtimePlan.findUnique({
      where: { id: req.params.id as string },
      include: {
        shift: true,
        items: {
          include: {
            machine: { select: { name: true, code: true } },
            backupMachine: { select: { name: true, code: true } },
            operator: { select: { fullName: true, employeeId: true } },
            product: { select: { productName: true, productCode: true } }
          },
          orderBy: { date: 'asc' }
        }
      }
    });
    if (!plan) return res.status(404).json({ error: 'Plan bulunamadı' });
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: 'Plan detayı getirilemedi: ' + error.message });
  }
});

// POST /api/overtime - Yeni plan oluştur
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { planName, startDate, endDate, shiftId, notes, items } = req.body;
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirket bilgisi bulunamadı' });

    const plan = await prisma.overtimePlan.create({
      data: {
        companyId,
        planName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        shiftId,
        notes,
        status: 'planned',
        createdBy: req.user?.fullName || req.user?.email || 'Sistem',
        items: {
          create: (items || []).map((item: any) => ({
            date: new Date(item.date),
            machineId: item.machineId,
            backupMachineId: item.backupMachineId || null,
            operatorId: item.operatorId,
            productId: item.productId || null,
            targetQuantity: item.targetQuantity || null,
            notes: item.notes || null
          }))
        }
      },
      include: {
        shift: true,
        items: {
          include: {
            machine: { select: { name: true } },
            operator: { select: { fullName: true } },
            product: { select: { productName: true } }
          }
        }
      }
    });
    res.status(201).json(plan);
  } catch (error: any) {
    console.error('[Overtime] Create error:', error);
    res.status(500).json({ error: 'Mesai planı oluşturulamadı: ' + error.message });
  }
});

// PUT /api/overtime/:id - Plan güncelle (Metadata + Items)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { planName, startDate, endDate, shiftId, notes, status, items } = req.body;
    const planId = req.params.id as string;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Planı güncelle
      const updatedPlan = await tx.overtimePlan.update({
        where: { id: planId },
        data: {
          planName: planName !== undefined ? planName : undefined,
          startDate: startDate !== undefined ? new Date(startDate) : undefined,
          endDate: endDate !== undefined ? new Date(endDate) : undefined,
          shiftId: shiftId !== undefined ? shiftId : undefined,
          notes: notes !== undefined ? notes : undefined,
          status: status !== undefined ? status : undefined,
        }
      });

      // 2. Eğer items gönderilmişse, eskileri sil ve yenileri ekle
      if (items && Array.isArray(items)) {
        await tx.overtimeItem.deleteMany({
          where: { planId }
        });

        await tx.overtimeItem.createMany({
          data: items.map((item: any) => ({
            planId,
            date: new Date(item.date),
            machineId: item.machineId || null,
            backupMachineId: item.backupMachineId || null,
            operatorId: item.operatorId,
            productId: item.productId || null,
            targetQuantity: item.targetQuantity || null,
            notes: item.notes || null
          }))
        });
      }

      return updatedPlan;
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Overtime] Update error:', error);
    res.status(500).json({ error: 'Plan güncellenemedi: ' + error.message });
  }
});

// DELETE /api/overtime/:id - Plan sil (cascade items)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.overtimePlan.delete({ where: { id: req.params.id as string } });
    res.json({ success: true, message: 'Mesai planı silindi.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Plan silinemedi: ' + error.message });
  }
});

export default router;
