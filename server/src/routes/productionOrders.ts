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
        product: { select: { productCode: true, productName: true, trackingType: true, stockType: true, category: true, productGroup: true } },
        steps: {
          include: { 
            operation: { select: { name: true, code: true } },
            operator: { select: { fullName: true, employeeId: true } },
            shift: { select: { shiftName: true } }
          },
          orderBy: { sequence: 'asc' }
        },
        components: { include: { componentProduct: true } },
        machines: { include: { machine: true } },
        events: { 
          include: { 
            operator: true,
            reason: { include: { group: true } },
            warehouse: true,
            step: { include: { operation: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
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
    const param = req.params.id as string;
    const isNumeric = /^\d+$/.test(param);
    
    const order = await prisma.productionOrder.findFirst({
      where: {
        companyId,
        OR: [
          { id: param },
          { lotNumber: param },
          ...(isNumeric ? [{ recordNumber: parseInt(param, 10) }] : [])
        ]
      },
      include: {
        product: true,
        steps: {
          include: { 
            operation: true, 
            operator: true, 
            shift: true 
          },
          orderBy: { sequence: 'asc' }
        },
        components: { include: { componentProduct: true } },
        machines: { include: { machine: true } },
        events: { 
          include: { 
            operator: true,
            reason: { include: { group: true } },
            warehouse: true,
            step: { include: { operation: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
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
    const id = req.params.id as string;
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
          status: req.body.status || undefined,
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
            productionOrderId: id as string,
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
        await tx.productionOrderMachine.deleteMany({ where: { productionOrderId: id as string } });
        await tx.productionOrderMachine.createMany({
          data: machines.map(m => ({
            productionOrderId: id as string,
            machineId: m.machineId,
            unitTimeSeconds: Number(m.unitTimeSeconds)
          }))
        });
      }

      // 4. Update Steps (Operational details)
      if (req.body.steps && Array.isArray(req.body.steps)) {
        for (const step of req.body.steps) {
          if (step.id) {
            await tx.productionOrderStep.update({
              where: { id: step.id },
              data: {
                status: step.status || 'pending',
                operatorId: (step.operatorId && step.operatorId !== '') ? step.operatorId : null,
                machineId: (step.machineId && step.machineId !== '') ? step.machineId : null,
                shiftId: (step.shiftId && step.shiftId !== '') ? step.shiftId : null,
                workType: step.workType || 'İşlem',
                approvedQty: Number(step.approvedQty || 0),
                rejectedQty: Number(step.rejectedQty || 0),
                reworkQty: Number(step.reworkQty || 0),
                sampleQty: Number(step.sampleQty || 0),
                conditionalQty: Number(step.conditionalQty || 0),
                startTime: step.startTime ? new Date(step.startTime) : null,
                endTime: step.endTime ? new Date(step.endTime) : null,
              }
            });
          } else {
            // Fallback for steps without ID or if ID-based update failed (as updateMany)
            await tx.productionOrderStep.updateMany({
              where: { 
                productionOrderId: id,
                sequence: step.sequence
              },
              data: {
                status: step.status || 'pending',
                operatorId: (step.operatorId && step.operatorId !== '') ? step.operatorId : null,
                machineId: (step.machineId && step.machineId !== '') ? step.machineId : null,
                shiftId: (step.shiftId && step.shiftId !== '') ? step.shiftId : null,
                workType: step.workType || 'İşlem',
                approvedQty: Number(step.approvedQty || 0),
                rejectedQty: Number(step.rejectedQty || 0),
                reworkQty: Number(step.reworkQty || 0),
                sampleQty: Number(step.sampleQty || 0),
                conditionalQty: Number(step.conditionalQty || 0),
                startTime: step.startTime ? new Date(step.startTime) : null,
                endTime: step.endTime ? new Date(step.endTime) : null,
              }
            });
          }
        }
      }

      // 5. Update Events (Sync events)
      if (req.body.events && Array.isArray(req.body.events)) {
        // Remove existing events and re-create to ensure synchronization with buffered state
        await tx.productionOrderEvent.deleteMany({ where: { productionOrderId: id } });
        
        // Filter out any invalid events and prepare for creation
        const validEvents = req.body.events.filter((e: any) => e.type && (e.quantity !== undefined));
        
        if (validEvents.length > 0) {
          await tx.productionOrderEvent.createMany({
            data: validEvents.map((e: any) => ({
              productionOrderId: id,
              stepId: e.stepId || null,
              type: e.type,
              quantity: e.quantity ? Number(e.quantity) : 0,
              operatorId: e.operatorId || null,
              reasonId: e.reasonId || null,
              warehouseId: e.warehouseId || null,
              description: e.description || '',
              createdAt: e.createdAt ? new Date(e.createdAt) : new Date()
            }))
          });
        }
      }
    });

    res.json({ success: true, message: 'Üretim emri güncellendi' });
  } catch (error) {
    console.error('Update production order error:', error);
    res.status(400).json({ error: 'Üretim emri güncellenemedi' });
  }
});

// Bulk duplicate production orders
router.post('/duplicate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids, count = 1 } = req.body; // Array of production order IDs and number of copies

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Geçersiz sipariş ID listesi' });
    }

    const duplicationCount = Math.max(1, Math.min(Number(count), 50)); // Limit to 50 copies for safety

    await prisma.$transaction(async (tx) => {
      // Get the highest record number currently to increment sequentially
      let lastOrder = await tx.productionOrder.findFirst({
        where: { companyId },
        orderBy: { recordNumber: 'desc' },
        select: { recordNumber: true }
      });
      let currentRecordNumber = lastOrder?.recordNumber || 0;

      for (const id of ids) {
        // Fetch the original order details
        const order = await tx.productionOrder.findFirst({
          where: { id, companyId },
          include: {
            steps: { orderBy: { sequence: 'asc' } },
            components: true,
            machines: true
          }
        });

        if (!order) continue; // Skip if not found
        if (order.status !== 'planned') {
           throw new Error(`Sadece 'Hazır' durumundaki üretim emirleri çoğaltılabilir. Hatalı Lot: ${order.lotNumber}`);
        }

        for (let i = 0; i < duplicationCount; i++) {
          currentRecordNumber++;
          const yearSuffix = new Date().getFullYear().toString().slice(-2);
          const lotNumberSequence = currentRecordNumber.toString().padStart(5, '0');
          const finalLotNumber = `${yearSuffix}${lotNumberSequence}`;

          const newOrder = await tx.productionOrder.create({
            data: {
              companyId: companyId!,
              recordNumber: currentRecordNumber,
              productId: order.productId,
              lotNumber: finalLotNumber,
              quantity: order.quantity,
              startDate: order.startDate ? new Date() : null,
              endDate: order.endDate ? new Date() : null,
              status: 'planned',
              type: order.type,
              targetWarehouseId: order.targetWarehouseId,
              notes: order.notes,
              expiryDate: order.expiryDate,
              sterilizationDate: order.sterilizationDate,
              parentId: order.parentId
            }
          });

          // 1. Create steps
          if (order.steps.length > 0) {
            await tx.productionOrderStep.createMany({
              data: order.steps.map(r => ({
                productionOrderId: newOrder.id,
                operationId: r.operationId,
                sequence: r.sequence,
                status: 'pending'
              }))
            });
          }

          // 2. Create components Link
          if (order.components.length > 0) {
            await tx.productionOrderComponent.createMany({
              data: order.components.map(c => ({
                productionOrderId: newOrder.id,
                componentProductId: c.componentProductId,
                quantity: c.quantity,
                notes: c.notes,
                unit: c.unit,
                consumptionType: c.consumptionType,
                warehouseId: c.warehouseId,
                lotNumber: c.lotNumber
              }))
            });
          }

          // 3. Create Machines assignment
          if (order.machines.length > 0) {
            await tx.productionOrderMachine.createMany({
              data: order.machines.map(m => ({
                productionOrderId: newOrder.id,
                machineId: m.machineId,
                unitTimeSeconds: m.unitTimeSeconds
              }))
            });
          }
        }
      }
    });

    res.json({ success: true, message: 'Seçili siparişler başarıyla çoğaltıldı' });
  } catch (error: any) {
    console.error('Duplicate production order error:', error);
    res.status(400).json({ error: error.message || 'Çoğaltma işlemi sırasında hata oluştu' });
  }
});

// Update step progress
router.patch('/steps/:stepId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const stepId = req.params.stepId as string;
    const { 
      approvedQty, rejectedQty, reworkQty, sampleQty, conditionalQty, 
      status, operatorId, machineId, shiftId, workType,
      startTime, endTime 
    } = req.body;

    const step = await prisma.productionOrderStep.update({
      where: { id: stepId },
      data: {
        approvedQty: approvedQty !== undefined ? Number(approvedQty) : undefined,
        rejectedQty: rejectedQty !== undefined ? Number(rejectedQty) : undefined,
        reworkQty: reworkQty !== undefined ? Number(reworkQty) : undefined,
        sampleQty: sampleQty !== undefined ? Number(sampleQty) : undefined,
        conditionalQty: conditionalQty !== undefined ? Number(conditionalQty) : undefined,
        status,
        operatorId,
        machineId,
        shiftId,
        workType,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined
      }
    });

    res.json(step);
  } catch (error) {
    res.status(400).json({ error: 'Operasyon adımı güncellenemedi' });
  }
});

// Update status
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const companyId = getCompanyId(req);
    
    // Get full order info
    const order = await prisma.productionOrder.findFirst({
      where: { id, companyId },
      include: { steps: true }
    });

    if (!order) return res.status(404).json({ error: 'Üretim emri bulunamadı' });

    if (status === order.status) return res.json(order);

    const result = await prisma.$transaction(async (tx) => {
      // 1. If moving AWAY from completed, reverse stock
      if (order.status === 'completed' && status !== 'completed') {
        const sortedSteps = [...order.steps].sort((a, b) => b.sequence - a.sequence);
        const finalQty = sortedSteps[0]?.approvedQty || order.quantity;

        if (order.targetWarehouseId) {
          // Decrement stock level
          await tx.stockLevel.update({
            where: {
              productId_warehouseId_lotNumber: {
                productId: order.productId,
                warehouseId: order.targetWarehouseId,
                lotNumber: order.lotNumber
              }
            },
            data: { quantity: { decrement: finalQty } }
          });

          // Delete stock movement
          await tx.stockMovement.deleteMany({
            where: {
              companyId,
              referenceId: order.id,
              type: 'PRODUCTION'
            }
          });
        }
      }

      // 2. If moving TO completed, apply stock
      if (status === 'completed' && order.status !== 'completed') {
        // Check all steps completed
        const allCompleted = order.steps.every(s => s.status === 'completed');
        if (!allCompleted) {
          throw new Error('Tüm operasyonlar tamamlanmadan üretim emri bitirilemez.');
        }

        const sortedSteps = [...order.steps].sort((a, b) => b.sequence - a.sequence);
        const finalQty = sortedSteps[0]?.approvedQty || order.quantity;

        if (order.targetWarehouseId) {
          // UPSERT stock level
          await tx.stockLevel.upsert({
            where: {
              productId_warehouseId_lotNumber: {
                productId: order.productId,
                warehouseId: order.targetWarehouseId,
                lotNumber: order.lotNumber
              }
            },
            update: { quantity: { increment: finalQty } },
            create: {
              companyId: companyId!,
              productId: order.productId,
              warehouseId: order.targetWarehouseId,
              lotNumber: order.lotNumber,
              quantity: finalQty
            }
          });

          // Log stock movement (Ensuring no duplicates by using update if exists? No, deleteMany first is safer if we want to be sure)
          await tx.stockMovement.deleteMany({
            where: { referenceId: order.id, type: 'PRODUCTION', companyId }
          });

          await tx.stockMovement.create({
            data: {
              companyId: companyId!,
              productId: order.productId,
              toWarehouseId: order.targetWarehouseId,
              lotNumber: order.lotNumber,
              type: 'PRODUCTION',
              quantity: finalQty,
              description: `Üretim Emri Tamamlandı - Lot: ${order.lotNumber}`,
              referenceId: order.id
            }
          });
        }
      }

      // 3. Update main order status
      return await tx.productionOrder.update({
        where: { id, companyId },
        data: { 
          status, 
          endDate: status === 'completed' ? new Date() : (status === 'planned' ? null : undefined) 
        }
      });
    });

    res.json(result);
  } catch (error: any) {
    console.error('Update status error:', error);
    res.status(400).json({ error: error.message || 'Durum güncellenemedi' });
  }
});

// Toggle star status
router.patch('/:id/star', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const companyId = getCompanyId(req);
    
    const existing = await prisma.productionOrder.findFirst({
      where: { id: id, companyId },
      select: { isStarred: true }
    });
    
    if (!existing) return res.status(404).json({ error: 'Emir bulunamadı' });

    const updated = await prisma.productionOrder.update({
      where: { id: id as string },
      data: { isStarred: !existing.isStarred }
    });

    res.json({ success: true, isStarred: updated.isStarred });
  } catch (error) {
    res.status(400).json({ error: 'Yıldızlanamadı' });
  }
});

// Delete production order
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const companyId = getCompanyId(req);

    // Delete elements linked to production order via cascades (prisma schema handles cascade deletion for components and steps, wait we need to explicitly delete if cascades are not fully set)
    // ProductionOrder has components, steps, machines. Let's delete them first to be safe.
    await prisma.$transaction([
      prisma.productionOrderComponent.deleteMany({ where: { productionOrderId: id as string } }),
      prisma.productionOrderStep.deleteMany({ where: { productionOrderId: id as string } }),
      prisma.productionOrderMachine.deleteMany({ where: { productionOrderId: id as string } }),
      prisma.productionOrderEvent.deleteMany({ where: { productionOrderId: id as string } }),
      prisma.productionOrder.delete({ where: { id: id as string, companyId } })
    ]);

    res.json({ success: true, message: 'Üretim emri silindi' });
  } catch (error) {
    res.status(400).json({ error: 'Silinirken bir hata oluştu' });
  }
});

// Create production order event
router.post('/:id/events', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const productionOrderId = req.params.id as string;
    const { stepId, type, quantity, operatorId, reasonId, warehouseId, description, createdAt } = req.body;

    const event = await prisma.productionOrderEvent.create({
      data: {
        productionOrderId,
        stepId: stepId || null,
        type,
        quantity: quantity ? Number(quantity) : null,
        operatorId: operatorId || null,
        reasonId: reasonId || null,
        warehouseId: warehouseId || null,
        description,
        createdAt: createdAt ? new Date(createdAt) : undefined
      },
      include: {
        productionOrder: { include: { product: true } },
        step: { include: { operation: true } },
        operator: true,
        reason: true,
        warehouse: true
      }
    });

    res.json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(400).json({ error: 'Olay kaydı oluşturulamadı.' });
  }
});

// Update production order event
router.put('/events/:eventId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const eventId = req.params.eventId as string;
    const { stepId, type, quantity, operatorId, reasonId, warehouseId, description, createdAt } = req.body;
    const companyId = getCompanyId(req);

    const existing = await prisma.productionOrderEvent.findFirst({
        where: { id: eventId, productionOrder: { companyId } }
    });
    if (!existing) return res.status(404).json({ error: 'Olay kaydı bulunamadı.' });

    const event = await prisma.productionOrderEvent.update({
      where: { id: eventId },
      data: {
        stepId: stepId || null,
        type,
        quantity: quantity ? Number(quantity) : null,
        operatorId: operatorId || null,
        reasonId: reasonId || null,
        warehouseId: warehouseId || null,
        description,
        createdAt: createdAt ? new Date(createdAt) : undefined
      },
      include: {
        productionOrder: { include: { product: true } },
        step: { include: { operation: true } },
        operator: true,
        reason: true,
        warehouse: true
      }
    });

    res.json(event);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(400).json({ error: 'Olay kaydı güncellenemedi.' });
  }
});

// Delete production order event
router.delete('/events/:eventId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const eventId = req.params.eventId as string;
    const companyId = getCompanyId(req);

    const existing = await prisma.productionOrderEvent.findFirst({
        where: { id: eventId, productionOrder: { companyId } }
    });
    if (!existing) return res.status(404).json({ error: 'Olay kaydı bulunamadı.' });

    await prisma.productionOrderEvent.delete({
      where: { id: eventId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Olay kaydı silinemedi.' });
  }
});

export default router;
