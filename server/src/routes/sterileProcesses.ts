import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// List sterile processes
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const processes = await prisma.sterileProcess.findMany({
      where: { companyId },
      include: {
        type: true,
        items: {
          include: {
            productionOrder: {
              include: { 
                product: true,
                steps: {
                  include: { operation: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(processes);
  } catch (error) {
    res.status(500).json({ error: 'Steril işlemler getirilemedi' });
  }
});

// Get eligible lots for sterile processing
router.get('/eligible-lots', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    // Find active production orders that have sterile operations and are sterile products
    // Also exclude lots that are already in a non-cancelled sterile process
    const orders = await prisma.productionOrder.findMany({
      where: {
        companyId,
        status: 'active',
        product: { isSterileProduct: true },
        sterileProcessItems: {
          none: {
            process: {
              status: { not: 'Cancelled' }
            }
          }
        }
      },
      include: {
        product: { select: { productCode: true, productName: true, unitOfMeasure: true } },
        steps: {
          include: { operation: true },
          orderBy: { sequence: 'asc' }
        }
      }
    });

    // Filter orders where the CURRENT pending step is a sterile operation
    const eligibleOrders = orders.filter(order => {
      const currentStep = order.steps.find(s => s.status !== 'completed');
      return currentStep?.operation?.isSterileOperation;
    });

    res.json(eligibleOrders);
  } catch (error) {
    res.status(500).json({ error: 'Uygun lotlar getirilemedi' });
  }
});

// Get single sterile process
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const process = await prisma.sterileProcess.findFirst({
      where: { id: req.params.id, companyId },
      include: {
        type: true,
        items: {
          include: {
            productionOrder: {
              include: { 
                product: true,
                steps: {
                  include: { operation: true }
                }
              }
            }
          }
        }
      }
    });

    if (!process) return res.status(404).json({ error: 'Steril işlem listesi bulunamadı' });

    // Diagnostic Logging
    console.log(`[SterileProcess GET] Process: ${process.id}, Items: ${process.items.length}`);
    process.items.forEach((item: any) => {
       const sterileCount = item.productionOrder?.steps?.filter((s: any) => s.operation?.isSterileOperation).length || 0;
       console.log(`  Lot: ${item.productionOrder?.lotNumber}, Total Steps: ${item.productionOrder?.steps?.length || 0}, Sterile Steps: ${sterileCount}`);
       item.productionOrder?.steps?.forEach((s: any) => {
         if (s.operation?.isSterileOperation) {
            console.log(`    Sterile Step found: ${s.operation?.name}, Status: ${s.status}, OpID: ${s.operationId}`);
         }
       });
    });

    res.json(process);
  } catch (error) {
    res.status(500).json({ error: 'Steril işlem listesi getirilemedi' });
  }
});

// Create new sterile process
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID missing' });

    const { typeId, documentUrl, documentName, notes, lotIds, items, status } = req.body;
    
    // Support both lotIds and items (from frontend)
    const orderIds = lotIds || (items && Array.isArray(items) ? items.map((i: any) => i.productionOrderId) : []);

    const process = await prisma.$transaction(async (tx) => {
      // 1. Generate SL00001 format number
      const lastProcess = await tx.sterileProcess.findFirst({
        where: { companyId },
        orderBy: { processNo: 'desc' },
        select: { processNo: true }
      });

      let nextNo = 1;
      if (lastProcess && lastProcess.processNo.startsWith('SL')) {
        const lastNoMatch = lastProcess.processNo.match(/\d+/);
        if (lastNoMatch) {
          nextNo = parseInt(lastNoMatch[0], 10) + 1;
        }
      }
      const processNo = `SL${nextNo.toString().padStart(5, '0')}`;

      // 2. Create the process
      const newProcess = await tx.sterileProcess.create({
        data: {
          companyId,
          processNo,
          processDate: new Date(),
          typeId,
          documentUrl,
          documentName,
          personnelName: req.user?.fullName || req.user?.email,
          status: status || 'Draft',
          notes
        }
      });

      // 3. Create items
      if (orderIds.length > 0) {
        await tx.sterileProcessItem.createMany({
          data: orderIds.map((orderId: string) => ({
            processId: newProcess.id,
            productionOrderId: orderId
          }))
        });

        // 4. If completed, update sterilizationDate on production orders ONLY.
        // Step signatures are applied exclusively by real users through the production order form.
        if (status === 'Completed') {
          await tx.productionOrder.updateMany({
            where: { id: { in: orderIds }, companyId },
            data: { sterilizationDate: new Date() }
          });
        }
      }

      return newProcess;
    });

    res.json(process);
  } catch (error) {
    console.error('[SterileProcess] Create error:', error);
    res.status(400).json({ error: 'Steril işlem listesi oluşturulurken hata oluştu' });
  }
});

// Update sterile process
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { status, typeId, documentUrl, documentName, notes, lotIds, items } = req.body;
    const processId = req.params.id;

    // Support both lotIds and items (from frontend)
    const orderIds = lotIds || (items && Array.isArray(items) ? items.map((i: any) => i.productionOrderId) : []);

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updateData: any = {
        status,
        typeId,
        documentUrl,
        documentName,
        notes,
        controlDate: now // Updated on every save as per request
      };

      if (status === 'Completed') {
        updateData.sterilizedDate = now;
      }

      const proc = await tx.sterileProcess.update({
        where: { id: processId, companyId },
        data: updateData
      });

      // Sync lotIds if provided
      if (orderIds.length > 0) {
        await tx.sterileProcessItem.deleteMany({ where: { processId } });
        await tx.sterileProcessItem.createMany({
          data: orderIds.map((orderId: string) => ({
            processId,
            productionOrderId: orderId
          }))
        });

        // If completed, update sterilizationDate on production orders ONLY.
        // Step signatures are applied exclusively by real users through the production order form.
        if (status === 'Completed') {
          await tx.productionOrder.updateMany({
            where: { id: { in: orderIds }, companyId },
            data: { sterilizationDate: now }
          });
        }
      }

      return proc;
    });

    res.json(updated);
  } catch (error: any) {
    console.error('[SterileProcess] Update error:', error);
    res.status(400).json({ error: error.message || 'Steril işlem listesi güncellenemedi' });
  }
});

// Delete sterile process
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.sterileProcess.delete({
      where: { id: req.params.id, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Steril işlem listesi silinemedi' });
  }
});

export default router;
