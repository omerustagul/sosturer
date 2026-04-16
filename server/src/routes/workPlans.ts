import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// GET all work plans
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { unitId } = req.query;

    const plans = await prisma.workPlan.findMany({
      where: { 
        companyId,
        unitId: unitId ? (unitId as string) : undefined
      },
      include: {
        unit: { select: { id: true, name: true } },
        _count: { select: { items: true } }
      },
      orderBy: { startDate: 'desc' }
    });

    res.json(plans);
  } catch (error) {
    console.error('Fetch work plans error:', error);
    res.status(500).json({ error: 'İş listeleri getirilemedi' });
  }
});

// GET single work plan with items
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const plan = await prisma.workPlan.findFirst({
      where: { id, companyId },
      include: {
        unit: { select: { id: true, name: true } },
        type: true,
        items: {
          include: {
            product: { select: { productCode: true, productName: true, productGroup: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!plan) return res.status(404).json({ error: 'İş listesi bulunamadı' });

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'İş listesi detayları getirilemedi' });
  }
});

// POST create work plan
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { unitId, planName, startDate, endDate, notes, items } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.workPlan.create({
        data: {
          companyId,
          unitId,
          planName,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          notes,
          typeId: req.body.typeId || null,
          status: 'active'
        }
      });

      if (items && Array.isArray(items) && items.length > 0) {
        await tx.workPlanItem.createMany({
          data: items.map((item: any) => ({
            workPlanId: plan.id,
            productId: item.productId,
            lotNumber: item.lotNumber,
            plannedQuantity: Number(item.plannedQuantity),
            orderStepId: item.orderStepId || null,
            notes: item.notes,
            status: 'pending'
          }))
        });
      }

      return plan;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Create work plan error:', error);
    res.status(500).json({ error: 'İş listesi oluşturulamadı' });
  }
});

// PUT update work plan
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { unitId, planName, startDate, endDate, notes, status, items } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Update header
      const plan = await tx.workPlan.update({
        where: { id, companyId },
        data: {
          unitId,
          planName,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          notes,
          typeId: req.body.typeId || null,
          status
        }
      });

      // If items are provided, reconcile them (simple approach: delete and recrease or update)
      // For simplicity in this initial version, we will replace items if they are passed
      if (items && Array.isArray(items)) {
        await tx.workPlanItem.deleteMany({ where: { workPlanId: id } });
        await tx.workPlanItem.createMany({
          data: items.map((item: any) => ({
            workPlanId: id,
            productId: item.productId,
            lotNumber: item.lotNumber,
            plannedQuantity: Number(item.plannedQuantity),
            orderStepId: item.orderStepId || null,
            notes: item.notes,
            status: item.status || 'pending'
          }))
        });
      }

      return plan;
    });

    res.json(result);
  } catch (error) {
    console.error('Update work plan error:', error);
    res.status(500).json({ error: 'İş listesi güncellenemedi' });
  }
});

// DELETE work plan
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    await prisma.workPlan.delete({
      where: { id, companyId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'İş listesi silinemedi' });
  }
});

// PATCH update item status/quantity
router.patch('/items/:itemId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const itemId = req.params.itemId as string;
    const { actualQuantity, status, notes } = req.body;

    const updatedItem = await prisma.workPlanItem.update({
      where: { id: itemId },
      data: {
        actualQuantity: actualQuantity !== undefined ? Number(actualQuantity) : undefined,
        status,
        notes
      }
    });

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Kalem güncellenemedi' });
  }
});

// GET available production steps for planning based on a type's target operation
router.get('/available-items/:typeId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const typeId = req.params.typeId as string;

    const planType = await prisma.workPlanType.findFirst({
      where: { id: typeId, companyId }
    });

    if (!planType) return res.status(404).json({ error: 'Liste türü bulunamadı' });

    // Find production steps that match the planType's target operation and are 'pending'
    const availableSteps = await prisma.productionOrderStep.findMany({
      where: {
        operationId: planType.targetOperationId,
        status: { in: ['pending', 'planned'] },
        productionOrder: { companyId }
      },
      include: {
        productionOrder: {
          include: { product: { select: { productCode: true, productName: true } } }
        }
      }
    });

    res.json(availableSteps);
  } catch (error) {
    res.status(500).json({ error: 'Planlanabilir kalemler getirilemedi' });
  }
});

export default router;
