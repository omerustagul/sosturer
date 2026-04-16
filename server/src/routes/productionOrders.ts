import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// List production orders with full details
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const orders = await prisma.productionOrder.findMany({
      where: { companyId },
      include: {
        product: { select: { productCode: true, productName: true, trackingType: true, stockType: true } },
        steps: {
          include: { operation: { select: { name: true, code: true } } },
          orderBy: { sequence: 'asc' }
        },
        components: { include: { componentProduct: true } },
        machines: { include: { machine: true } },
        events: { include: { operator: true } },
        parent: { select: { lotNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Üretim emirleri getirilemedi' });
  }
});

// GET single production order
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const order = await prisma.productionOrder.findFirst({
      where: { id: req.params.id as string, companyId },
      include: {
        product: true,
        steps: {
          include: { operation: true },
          orderBy: { sequence: 'asc' }
        },
        components: { include: { componentProduct: true } },
        machines: { include: { machine: true } },
        events: { include: { operator: true } }
      }
    });
    if (!order) return res.status(404).json({ error: 'Üretim emri bulunamadı' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Detaylar getirilemedi' });
  }
});

// Create professional production order
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID missing' });

    const {
      productId, lotNumber, quantity, startDate, endDate,
      type, targetWarehouseId, notes, expiryDate, sterilizationDate,
      components, // Array of { componentProductId, quantity, notes }
      machines,    // Array of { machineId, unitTimeSeconds }
      parentId
    } = req.body;

    // Fetch product details for defaults
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        route: { include: { steps: true } }
      }
    });

    if (!product) return res.status(404).json({ error: 'Ürün bulunamadı.' });

    const recipe = product.route?.steps?.sort((a, b) => a.sequence - b.sequence) || [];

    if (recipe.length === 0) {
      return res.status(400).json({ error: 'Ürüne ait atanmış bir reçete veya reçetede işlem adımları bulunamadı.' });
    }

    const order = await prisma.$transaction(async (tx) => {
      // Auto numbering
      const lastOrder = await tx.productionOrder.findFirst({
        where: { companyId },
        orderBy: { recordNumber: 'desc' },
        select: { recordNumber: true }
      });
      const nextRecordNumber = (lastOrder?.recordNumber || 0) + 1;

      // Auto lot generation if not provided
      let finalLotNumber = lotNumber;
      if (!finalLotNumber) {
        const yearSuffix = new Date().getFullYear().toString().slice(-2);
        const lotNumberSequence = nextRecordNumber.toString().padStart(5, '0');
        finalLotNumber = `${yearSuffix}${lotNumberSequence}`;
      }

      const newOrder = await tx.productionOrder.create({
        data: {
          companyId,
          recordNumber: nextRecordNumber,
          productId,
          lotNumber: finalLotNumber,
          quantity: Number(quantity),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          status: 'planned',
          type: type || 'Asıl',
          targetWarehouseId,
          notes,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          sterilizationDate: sterilizationDate ? new Date(sterilizationDate) : null,
          parentId
        }
      });

      // 1. Create steps based on route steps
      await tx.productionOrderStep.createMany({
        data: recipe.map(r => ({
          productionOrderId: newOrder.id,
          operationId: r.operationId,
          sequence: r.sequence,
          status: 'pending'
        }))
      });

      // 2. Create components Link
      if (components && Array.isArray(components)) {
        await tx.productionOrderComponent.createMany({
          data: components.map(c => ({
            productionOrderId: newOrder.id,
            componentProductId: c.componentProductId,
            quantity: Number(c.quantity),
            notes: c.notes
          }))
        });
      }

      // 3. Create Machines assignment
      if (machines && Array.isArray(machines)) {
        await tx.productionOrderMachine.createMany({
          data: machines.map(m => ({
            productionOrderId: newOrder.id,
            machineId: m.machineId,
            unitTimeSeconds: Number(m.unitTimeSeconds)
          }))
        });
      }

      return newOrder;
    });

    res.json(order);

    // Bildirim gönder
    NotificationService.notifyNewProductionOrder(
      companyId!,
      order.lotNumber,
      product.productName
    );
  } catch (error) {
    console.error('Pro Production order creation error:', error);
    res.status(400).json({ error: 'Üretim emri oluşturulamadı. Verileri kontrol edin.' });
  }
});


// Update professional production order
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const {
      productId, lotNumber, quantity, startDate, endDate,
      type, targetWarehouseId, notes, expiryDate, sterilizationDate,
      components,
      machines
    } = req.body;

    await prisma.$transaction(async (tx) => {
      // 1. Update main order
      await tx.productionOrder.update({
        where: { id: id as string, companyId },
        data: {
          productId,
          lotNumber,
          quantity: Number(quantity),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          type: type || 'Asıl',
          targetWarehouseId,
          notes,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          sterilizationDate: sterilizationDate ? new Date(sterilizationDate) : null,
        }
      });

      // 2. Update components (Delete and Re-create for simplicity in this version)
      if (components && Array.isArray(components)) {
        await tx.productionOrderComponent.deleteMany({ where: { productionOrderId: id } });
        await tx.productionOrderComponent.createMany({
          data: components.map(c => ({
            productionOrderId: id,
            componentProductId: c.componentProductId,
            quantity: Number(c.quantity),
            unit: c.unit,
            consumptionType: c.consumptionType,
            warehouseId: c.warehouseId,
            lotNumber: c.lotNumber,
            notes: c.notes
          }))
        });
      }

      // 3. Update Machines
      if (machines && Array.isArray(machines)) {
        await tx.productionOrderMachine.deleteMany({ where: { productionOrderId: id } });
        await tx.productionOrderMachine.createMany({
          data: machines.map(m => ({
            productionOrderId: id,
            machineId: m.machineId,
            unitTimeSeconds: Number(m.unitTimeSeconds)
          }))
        });
      }
    });

    res.json({ success: true, message: 'Üretim emri güncellendi' });
  } catch (error) {
    console.error('Update production order error:', error);
    res.status(400).json({ error: 'Üretim emri güncellenemedi' });
  }
});

// Update step progress
router.patch('/steps/:stepId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const stepId = req.params.stepId as string;
    const { approvedQty, rejectedQty, sampleQty, status, operatorId, machineId, startTime, endTime } = req.body;

    const step = await prisma.productionOrderStep.update({
      where: { id: stepId },
      data: {
        approvedQty: approvedQty !== undefined ? Number(approvedQty) : undefined,
        rejectedQty: rejectedQty !== undefined ? Number(rejectedQty) : undefined,
        sampleQty: sampleQty !== undefined ? Number(sampleQty) : undefined,
        status,
        operatorId,
        machineId,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined
      }
    });

    res.json(step);
  } catch (error) {
    res.status(400).json({ error: 'Operasyon adımı güncellenemedi' });
  }
});

export default router;
