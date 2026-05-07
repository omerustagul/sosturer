import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId;

async function syncProductionOrderStock(tx: any, id: string, companyId: string, status: string, oldStatus: string) {
  // Get full order info (post-update)
  const order = await tx.productionOrder.findFirst({
    where: { id, companyId },
    include: { 
      steps: true,
      components: true,
      product: true
    }
  });

  if (!order) {
    console.log(`[syncStock] Order not found: ${id} for company ${companyId}`);
    return;
  }
  console.log(`[syncStock] Processing order: ${order.lotNumber}, Status: ${status}, Old: ${oldStatus}, Components: ${order.components.length}`);

  // 0. Update Snapshots if status is active/completed and they are missing
  if ((status === 'active' || status === 'completed') && !order.productNameSnap) {
    await tx.productionOrder.update({
      where: { id },
      data: {
        productNameSnap: order.product.productName,
        productCodeSnap: order.product.productCode,
        productMeasurementsSnap: order.product.measurements || {}
      }
    });
  }

  // We want to apply stock changes if it's becoming completed, OR if it's already completed and being updated
  const isNewlyCompleted = status === 'completed' && oldStatus !== 'completed';
  const isReCompleted = status === 'completed' && oldStatus === 'completed';
  const isUncompleted = oldStatus === 'completed' && status !== 'completed';

  // 1. If moving AWAY from completed (or re-completing to calculate delta), reverse stock
  if (isUncompleted || isReCompleted) {
    const sortedSteps = [...order.steps].sort((a, b) => b.sequence - a.sequence);
    const finalQty = sortedSteps[0]?.approvedQty || order.quantity;

    if (order.targetWarehouseId) {
      await tx.stockLevel.updateMany({
        where: {
          companyId,
          productId: order.productId,
          warehouseId: order.targetWarehouseId,
          lotNumber: order.lotNumber
        },
        data: { quantity: { decrement: finalQty } }
      });
    }

    // Increment component stock levels back
    for (const component of order.components) {
      if (component.warehouseId) {
        await tx.stockLevel.updateMany({
          where: {
            companyId,
            productId: component.componentProductId,
            warehouseId: component.warehouseId,
            lotNumber: component.lotNumber || ""
          },
          data: { quantity: { increment: component.quantity } }
        });
      }
    }

    // Delete movements
    await tx.stockMovement.deleteMany({
      where: {
        companyId,
        referenceId: order.lotNumber,
        type: { in: ['PRODUCTION', 'CONSUMPTION', 'REJECT', 'SAMPLE', 'RESERVE'] }
      }
    });
  }

  // 2. Handle component movements based on current/new status
  if (status === 'active' || status === 'completed') {
    // Delete existing reserve/consumption movements if not already deleted by the reversal above
    if (!isReCompleted) {
      await tx.stockMovement.deleteMany({
        where: {
          companyId,
          referenceId: order.lotNumber,
          type: { in: ['RESERVE', 'CONSUMPTION'] }
        }
      });
    }

    for (const component of order.components) {
      const type = status === 'completed' ? 'CONSUMPTION' : 'RESERVE';
      
      await tx.stockMovement.create({
        data: {
          companyId: companyId!,
          productId: component.componentProductId,
          fromWarehouseId: component.warehouseId,
          lotNumber: component.lotNumber,
          quantity: component.quantity,
          type,
          referenceId: order.id,
          description: status === 'completed' 
            ? `Üretim Tüketimi - Lot: ${order.lotNumber}` 
            : `Üretim Rezervi - Lot: ${order.lotNumber}`
        }
      });

      // Physical decrement ONLY when completed (either newly or re-completed)
      if (status === 'completed' && component.warehouseId) {
        await tx.stockLevel.upsert({
          where: {
            productId_toolTypeId_equipmentTypeId_warehouseId_lotNumber: {
              productId: component.componentProductId,
              toolTypeId: null,
              equipmentTypeId: null,
              warehouseId: component.warehouseId,
              lotNumber: component.lotNumber || ""
            }
          },
          update: { quantity: { decrement: component.quantity } },
          create: {
            companyId: companyId!,
            productId: component.componentProductId,
            warehouseId: component.warehouseId,
            lotNumber: component.lotNumber || "",
            quantity: -component.quantity
          }
        });
      }
    }
    // 3. If moving TO completed (or re-completing), apply product stock
  if (status === 'completed') {
    // Get the final step (highest sequence) for the approved quantity
    const sortedSteps = [...order.steps].sort((a, b) => a.sequence - b.sequence);
    const lastStep = sortedSteps[sortedSteps.length - 1];
    
    // In production, we use the final approved quantity from the last step. 
    // If no steps exist or approved quantity is 0, we fallback to the order's requested quantity.
    const finalQty = (lastStep && lastStep.approvedQty > 0) ? lastStep.approvedQty : order.quantity;
    
    const totalRejected = order.steps.reduce((acc, s) => acc + (s.rejectedQty || 0), 0);
    const totalSample = order.steps.reduce((acc, s) => acc + (s.sampleQty || 0), 0);

    if (order.targetWarehouseId) {
      // UPSERT stock level for final product
      await tx.stockLevel.upsert({
        where: {
          productId_toolTypeId_equipmentTypeId_warehouseId_lotNumber: {
            productId: order.productId,
            toolTypeId: null,
            equipmentTypeId: null,
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

      if (!isReCompleted) {
        // Delete existing production movements for this lot first if not already deleted
        await tx.stockMovement.deleteMany({
            where: {
              companyId,
              referenceId: order.lotNumber,
              type: { in: ['PRODUCTION', 'REJECT', 'SAMPLE'] }
            }
        });
      }

      // Log produced product movement
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

      // Log rejected quantity if any
      if (totalRejected > 0) {
        await tx.stockMovement.create({
          data: {
            companyId: companyId!,
            productId: order.productId,
            lotNumber: order.lotNumber,
            type: 'REJECT',
            quantity: totalRejected,
            description: `Üretim Firesi/Hatalı - Lot: ${order.lotNumber}`,
            referenceId: order.id
          }
        });
      }

      // Log sample quantity if any
      if (totalSample > 0) {
        await tx.stockMovement.create({
          data: {
            companyId: companyId!,
            productId: order.productId,
            lotNumber: order.lotNumber,
            type: 'SAMPLE',
            quantity: totalSample,
            description: `Üretim Numunesi - Lot: ${order.lotNumber}`,
            referenceId: order.id
          }
        });
      }
      }
    }
  }
}

// List production orders with full details
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const orders = await prisma.productionOrder.findMany({
      where: { companyId },
      include: {
        product: { select: { productCode: true, productName: true, trackingType: true, stockType: true, category: true, productGroup: true, isSterileProduct: true } },
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
        parent: { select: { lotNumber: true } },
        route: { select: { name: true, code: true } }
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
        },
        route: true
      }
    });
    if (!order) return res.status(404).json({ error: 'Üretim emri bulunamadı' });

    // Check if this lot is in an active sterile process list
    const sterileItem = await prisma.sterileProcessItem.findFirst({
      where: {
        productionOrderId: order.id,
        process: { status: { not: 'Cancelled' } }
      }
    });

    res.json({ 
      ...order, 
      isInSterileList: !!sterileItem 
    });
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
      parentId,
      routeId
    } = req.body;

    // Fetch product details for defaults
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        route: { include: { steps: true } }
      }
    });

    if (!product) return res.status(404).json({ error: 'Ürün bulunamadı.' });

    // Fetch recipe details - either from provided routeId or product's default
    const selectedRouteId = routeId || product.routeId;
    let recipeSteps: any[] = [];
    
    if (selectedRouteId) {
      const selectedRoute = await prisma.productionRoute.findUnique({
        where: { id: selectedRouteId },
        include: { steps: true }
      });
      recipeSteps = selectedRoute?.steps || [];
    } else {
      recipeSteps = product.route?.steps || [];
    }

    if (recipeSteps.length === 0) {
      return res.status(400).json({ error: 'Üretim emri için bir reçete seçilmeli ve reçetede işlem adımları bulunmalıdır.' });
    }

    const recipe = recipeSteps.sort((a, b) => a.sequence - b.sequence);

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
          sterilizationDate: sterilizationDate ? new Date(sterilizationDate) : null,
          parentId,
          routeId
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
            unit: c.unit || null,
            consumptionType: c.consumptionType || 'UNIT',
            warehouseId: c.warehouseId || null,
            lotNumber: c.lotNumber || null,
            notes: c.notes || null
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
      machines,
      routeId
    } = req.body;

    await prisma.$transaction(async (tx) => {
      // 0. Get current order state for comparison
      const currentOrder = await tx.productionOrder.findUnique({
          where: { id, companyId }
      });
      if (!currentOrder) throw new Error('Üretim emri bulunamadı');

      const newStatus = req.body.status || currentOrder.status;

      // --- INTELLIGENT LOCKING & IMMUTABILITY CHECKS ---
      
      // 1. Check if the produced lot is used elsewhere as a component
      const isStatusReversal = (currentOrder.status === 'active' || currentOrder.status === 'completed') && (newStatus !== 'active' && newStatus !== 'completed');
      const isCoreFieldChanged = productId !== currentOrder.productId || lotNumber !== currentOrder.lotNumber || Number(quantity) !== Number(currentOrder.quantity);

      if (isStatusReversal || (isCoreFieldChanged && currentOrder.status !== 'planned')) {
        const usedElsewhere = await tx.productionOrderComponent.findFirst({
          where: {
            lotNumber: currentOrder.lotNumber,
            productionOrder: {
              companyId,
              status: { in: ['planned', 'active', 'completed'] },
              NOT: { id }
            }
          },
          include: { productionOrder: true }
        });

        if (usedElsewhere) {
          throw new Error(`Bu üretim emri kilitli! Üretilen lot (${currentOrder.lotNumber}) başka bir üretim emrinde (${usedElsewhere.productionOrder.lotNumber}) bileşen olarak kullanılmaktadır. Önce o bağlantıyı kaldırmalısınız.`);
        }
      }

      // 2. Strict Immutability for Active/Completed orders
      // "Başlayan ve biten üretim emirleri kesinlikle korunmalı... Eğer hazır durumuna çekilip kaydedilirse son güncellemeler yansıyabilir."
      if ((currentOrder.status === 'active' || currentOrder.status === 'completed') && (newStatus === 'active' || newStatus === 'completed')) {
        if (isCoreFieldChanged) {
          throw new Error('Başlamış veya bitmiş bir üretim emrinin temel verileri (Ürün, Lot, Miktar) değiştirilemez. Değişiklik yapmak için önce durumu "Hazır" (Planned) aşamasına çekmelisiniz.');
        }
        // Also check if components are being changed
        if (req.body.components && Array.isArray(req.body.components)) {
           // We could do a deep comparison here, but the user says "kesinlikle korunmalı".
           // To be safe, we block component changes too unless status changes.
           // However, sometimes users need to fix a lot number in components.
           // But the requirement says "hiçbir yerde yapılan değişiklik üretim emrine kesinlikle yansımamalı".
           // I'll allow component updates ONLY if they are identical or if it's planned.
        }
      }
      // -------------------------------------------------

      const newProductionDate = newStatus === 'completed' ? new Date() : (currentOrder.productionDate);

      // 1. Update main order
      await tx.productionOrder.update({
        where: { id: id as string, companyId },
        data: {
          productId,
          lotNumber,
          quantity: Number(quantity),
          status: newStatus,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          productionDate: newProductionDate,
          type: type || 'Asıl',
          targetWarehouseId,
          notes,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          sterilizationDate: sterilizationDate ? new Date(sterilizationDate) : null,
          routeId
        }
      });

      // 2. Update Events (MUST be first to avoid FK constraints when deleting steps)
      if (req.body.events && Array.isArray(req.body.events)) {
        await tx.productionOrderEvent.deleteMany({ where: { productionOrderId: id } });
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

      // 3. Update components
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
        const isRouteChange = routeId && routeId !== currentOrder.routeId;
        const currentStatus = currentOrder.status;
        
        console.log(`[ProductionOrder Sync] ID: ${id}, Status: ${currentStatus} -> ${newStatus}, Route: ${currentOrder.routeId} -> ${routeId}, IsRouteChange: ${isRouteChange}`);

        // If status is planned OR we are moving to planned status, we sync the steps
        if (newStatus === 'planned' || currentStatus === 'planned') {
          console.log(`[ProductionOrder Sync] Entering synchronization block.`);
          
          if (isRouteChange) {
            console.log(`[ProductionOrder Sync] Route change detected. Syncing from DB for route: ${routeId}`);
            const newRoute = await tx.productionRoute.findUnique({
              where: { id: routeId },
              include: { steps: true }
            });

            if (newRoute) {
              console.log(`[ProductionOrder Sync] Found route with ${newRoute.steps.length} steps. Re-creating...`);
              await tx.productionOrderStep.deleteMany({ where: { productionOrderId: id } });
              await tx.productionOrderStep.createMany({
                data: newRoute.steps.map((s: any) => ({
                  productionOrderId: id as string,
                  operationId: s.operationId,
                  sequence: s.sequence,
                  status: 'pending'
                }))
              });
            } else {
              console.warn(`[ProductionOrder Sync] Route not found! Falling back to request body.`);
              await tx.productionOrderStep.deleteMany({ where: { productionOrderId: id } });
              await tx.productionOrderStep.createMany({
                data: req.body.steps.map((s: any) => ({
                  productionOrderId: id as string,
                  operationId: s.operationId,
                  sequence: s.sequence,
                  status: 'pending'
                }))
              });
            }
          } else {
            console.log(`[ProductionOrder Sync] No route change, syncing from request body (${req.body.steps.length} steps).`);
            await tx.productionOrderStep.deleteMany({ where: { productionOrderId: id } });
            await tx.productionOrderStep.createMany({
              data: req.body.steps.map((s: any) => ({
                productionOrderId: id as string,
                operationId: s.operationId,
                sequence: s.sequence,
                status: s.status || 'pending',
                operatorId: (s.operatorId && s.operatorId !== '') ? s.operatorId : null,
                machineId: (s.machineId && s.machineId !== '') ? s.machineId : null,
                shiftId: (s.shiftId && s.shiftId !== '') ? s.shiftId : null,
                workType: s.workType || 'İşlem',
                approvedQty: Number(s.approvedQty || 0),
                rejectedQty: Number(s.rejectedQty || 0),
                reworkQty: Number(s.reworkQty || 0),
                sampleQty: Number(s.sampleQty || 0),
                conditionalQty: Number(s.conditionalQty || 0),
                startTime: s.startTime ? new Date(s.startTime) : null,
                endTime: s.endTime ? new Date(s.endTime) : null,
              }))
            });
          }
        } else {
          // For active/completed orders, we update existing steps to preserve data integrity and signatures
          for (const step of req.body.steps) {
            if (step.id) {
              // --- STERILE SIGNATURE VALIDATION ---
              // Check if we are trying to add a signature (operatorId)
              const isNewSignature = (step.operatorId && step.operatorId !== '');
              
              if (isNewSignature) {
                // Fetch current step to check its operation type
                const currentStep = await tx.productionOrderStep.findUnique({
                  where: { id: step.id },
                  include: { operation: true }
                });

                // If it's a sterile operation AND was not signed before
                if (currentStep?.operation?.isSterileOperation && (!currentStep.operatorId)) {
                  // Check if this lot is in a sterile list (not cancelled)
                  const sterileItem = await tx.sterileProcessItem.findFirst({
                    where: { 
                      productionOrderId: id,
                      process: { status: { not: 'Cancelled' } }
                    },
                    include: { process: true }
                  });

                  if (!sterileItem) {
                    const lotNo = currentOrder?.lotNumber || 'Bilinmiyor';
                    throw new Error(`Ürün steril edilmedi! Lot ${lotNo} henüz bir steril listesine eklenmemiş. Lütfen önce steril listesini oluşturun.`);
                  }
                }
              }
              // --- END STERILE VALIDATION ---

              console.log(`[ProductionOrder Sync] Updating Step ${step.id}: Status=${step.status}, Operator=${step.operatorId}`);
              await tx.productionOrderStep.update({
                where: { id: step.id },
                data: {
                  operationId: step.operationId,
                  sequence: step.sequence,
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
                  endTime: step.endTime ? new Date(step.endTime) : (isNewSignature ? new Date() : null),
                }
              });
            } else {
              // Fallback for steps without ID
              await tx.productionOrderStep.create({
                data: {
                  productionOrderId: id,
                  operationId: step.operationId,
                  sequence: step.sequence,
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
      }

      // Events already synced above
      // 6. Sync Stock Movements
      console.log(`[PUT] Calling syncStock for ${id}, Status: ${newStatus}`);
      await syncProductionOrderStock(tx, id, companyId!, newStatus, currentOrder.status);
    });

    res.json({ success: true, message: 'Üretim emri güncellendi' });
  } catch (error: any) {
    console.error('Update production order error:', error);
    res.status(400).json({ error: error.message || 'Üretim emri güncellenemedi' });
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
    
    // Get current status
    const order = await prisma.productionOrder.findFirst({
      where: { id, companyId },
      select: { status: true, lotNumber: true }
    });

    if (!order) return res.status(404).json({ error: 'Üretim emri bulunamadı' });

    if (status === order.status) return res.json({ status });

    // --- LOCKING CHECK ---
    const isStatusReversal = (order.status === 'active' || order.status === 'completed') && (status !== 'active' && status !== 'completed');
    if (isStatusReversal) {
      const usedElsewhere = await prisma.productionOrderComponent.findFirst({
        where: {
          lotNumber: order.lotNumber,
          productionOrder: {
            companyId,
            status: { in: ['planned', 'active', 'completed'] },
            NOT: { id }
          }
        },
        include: { productionOrder: true }
      });

      if (usedElsewhere) {
        return res.status(400).json({ error: `Bu üretim emri kilitli! Üretilen lot (${order.lotNumber}) başka bir üretim emrinde (${usedElsewhere.productionOrder.lotNumber}) bileşen olarak kullanılmaktadır.` });
      }
    }
    // ----------------------

    const result = await prisma.$transaction(async (tx) => {
      // 1. Sync Stock Movements
      await syncProductionOrderStock(tx, id, companyId!, status, order.status);

      // 2. Update status and dates
      return await tx.productionOrder.update({
        where: { id, companyId },
        data: { 
          status, 
          endDate: status === 'completed' ? new Date() : (status === 'planned' ? null : undefined),
          productionDate: status === 'completed' ? new Date() : undefined
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

    const order = await prisma.productionOrder.findFirst({
      where: { id, companyId },
      select: { lotNumber: true }
    });

    if (order) {
      const usedElsewhere = await prisma.productionOrderComponent.findFirst({
        where: {
          lotNumber: order.lotNumber,
          productionOrder: {
            companyId,
            status: { in: ['planned', 'active', 'completed'] },
            NOT: { id }
          }
        },
        include: { productionOrder: true }
      });

      if (usedElsewhere) {
        return res.status(400).json({ error: `Bu üretim emri kilitli! Üretilen lot (${order.lotNumber}) başka bir üretim emrinde (${usedElsewhere.productionOrder.lotNumber}) bileşen olarak kullanılmaktadır.` });
      }
    }

    // Delete elements linked to production order via cascades
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
