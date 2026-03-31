import { Router } from 'express';
import prisma from '../lib/prisma';
import { calculateOEE, rebalanceShift } from '../services/oeeCalculator';
import { endOfDay, isValid, parseISO, startOfDay } from 'date-fns';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// GET shift context (for frontend automation)
router.get('/shift-context', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { date, machineId, shiftId, excludeId } = req.query;
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });
    if (!date || !machineId || !shiftId) return res.json({ totalActual: 0, totalPlanned: 0 });

    const targetDate = new Date(date as string);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const records = await prisma.productionRecord.findMany({
      where: {
        companyId,
        productionDate: { gte: targetDate, lt: nextDay },
        machineId: machineId as string,
        shiftId: shiftId as string,
        NOT: excludeId ? { id: excludeId as string } : undefined
      }
    });

    const totalActual = records.reduce((acc, r) => acc + (r.producedQuantity * r.cycleTimeSeconds) / 60, 0);
    const totalPlanned = records.reduce((acc, r) => acc + (r.plannedDowntimeMinutes || 0), 0);

    res.json({ totalActual, totalPlanned });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shift context' });
  }
});

// GET all production records with relations
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const q = req.query as Record<string, unknown>;
    const startParam = (q.start ?? q.startDate ?? q.start_date) as string | undefined;
    const endParam = (q.end ?? q.endDate ?? q.end_date) as string | undefined;

    const machineId = (q.machineId ?? q.machine_id) as string | undefined;
    const operatorId = (q.operatorId ?? q.operator_id) as string | undefined;
    const productId = (q.productId ?? q.product_id) as string | undefined;
    const shiftId = (q.shiftId ?? q.shift_id) as string | undefined;

    const where: any = { companyId };

    if (startParam || endParam) {
      where.productionDate = {};
      if (typeof startParam === 'string' && startParam.trim()) {
        const d = parseISO(startParam);
        if (!isValid(d)) return res.status(400).json({ error: 'Invalid start date' });
        where.productionDate.gte = startOfDay(d);
      }
      if (typeof endParam === 'string' && endParam.trim()) {
        const d = parseISO(endParam);
        if (!isValid(d)) return res.status(400).json({ error: 'Invalid end date' });
        where.productionDate.lte = endOfDay(d);
      }
    }

    if (machineId) where.machineId = machineId;
    if (operatorId) where.operatorId = operatorId;
    if (productId) where.productId = productId;
    if (shiftId) where.shiftId = shiftId;

    const records = await prisma.productionRecord.findMany({
      where,
      include: {
        machine: { select: { code: true, name: true } },
        operator: { select: { fullName: true } },
        shift: { select: { shiftCode: true, shiftName: true, durationMinutes: true } },
        product: { select: { id: true, productCode: true, productName: true, productGroup: true, category: true, brand: true } },
      },
      orderBy: { productionDate: 'desc' },
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET record by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const record = await prisma.productionRecord.findFirst({
      where: { id: req.params.id as string, companyId },
      include: {
        machine: true,
        operator: true,
        shift: true,
        product: true,
      },
    });
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// CREATE record
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const {
      productionDate,
      shiftId,
      machineId,
      operatorId,
      productId,
      producedQuantity,
      cycleTimeSeconds,
      plannedDowntimeMinutes = 0,
      defectQuantity = 0,
      notes = ''
    } = req.body;

    const shift = await prisma.shift.findFirst({ where: { id: shiftId, companyId } });
    if (!shift) return res.status(400).json({ error: 'Selected shift not found' });

    // Initial simple calculation for creation
    const oeeResult = await calculateOEE({
      producedQuantity,
      cycleTimeSeconds,
      plannedDowntimeMinutes,
      defectQuantity,
      shiftDurationMinutes: shift.durationMinutes
    });

    const record = await prisma.productionRecord.create({
      data: {
        companyId,
        productionDate: new Date(productionDate),
        shiftId,
        machineId,
        operatorId,
        productId,
        producedQuantity,
        actualDurationMinutes: oeeResult.actualDurationMinutes || 0,
        cycleTimeSeconds,
        plannedDowntimeMinutes,
        unplannedDowntimeMinutes: oeeResult.unplannedDowntimeMinutes || 0,
        downtimeMinutes: oeeResult.downtimeMinutes || 0,
        plannedDurationMinutes: oeeResult.plannedDurationMinutes,
        availability: oeeResult.availability,
        performance: oeeResult.performance,
        quality: oeeResult.quality,
        oee: oeeResult.oee,
        defectQuantity,
        plannedQuantity: oeeResult.plannedQuantity,
        notes
      },
    });

    // REBALANCE for multi-product
    await rebalanceShift(new Date(productionDate), machineId, shiftId, companyId);

    const updated = await prisma.productionRecord.findUnique({ where: { id: record.id as string } });
    res.status(201).json(updated);
  } catch (error) {
    console.error('Record creation error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// UPDATE record
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const {
      shiftId,
      producedQuantity,
      cycleTimeSeconds,
      plannedDowntimeMinutes,
      defectQuantity,
      productionDate,
      machineId,
      ...rest
    } = req.body;

    const existing = await prisma.productionRecord.findFirst({ where: { id: req.params.id as string, companyId } });
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const targetShiftId = shiftId || existing.shiftId;
    const targetDate = productionDate ? new Date(productionDate) : existing.productionDate;
    const targetMachineId = machineId || existing.machineId;

    const shift = await prisma.shift.findFirst({ where: { id: targetShiftId, companyId } });
    if (!shift) return res.status(400).json({ error: 'Shift not found' });

    const oeeResult = await calculateOEE({
      producedQuantity: producedQuantity ?? existing.producedQuantity,
      cycleTimeSeconds: cycleTimeSeconds ?? existing.cycleTimeSeconds,
      plannedDowntimeMinutes: plannedDowntimeMinutes ?? existing.plannedDowntimeMinutes,
      defectQuantity: defectQuantity ?? existing.defectQuantity,
      shiftDurationMinutes: shift.durationMinutes
    });

    const record = await prisma.productionRecord.update({
      where: { id: req.params.id as string },
      data: {
        ...rest,
        shiftId: targetShiftId,
        machineId: targetMachineId,
        productionDate: targetDate,
        producedQuantity,
        actualDurationMinutes: oeeResult.actualDurationMinutes,
        cycleTimeSeconds,
        plannedDowntimeMinutes,
        unplannedDowntimeMinutes: oeeResult.unplannedDowntimeMinutes,
        downtimeMinutes: oeeResult.downtimeMinutes,
        plannedDurationMinutes: oeeResult.plannedDurationMinutes,
        availability: oeeResult.availability,
        performance: oeeResult.performance,
        quality: oeeResult.quality,
        oee: oeeResult.oee,
        defectQuantity,
        plannedQuantity: oeeResult.plannedQuantity,
      },
    });

    // REBALANCE for current (and old if changed)
    await rebalanceShift(targetDate, targetMachineId, targetShiftId, companyId);
    if (existing.shiftId !== targetShiftId || existing.machineId !== targetMachineId) {
      await rebalanceShift(existing.productionDate, existing.machineId, existing.shiftId, companyId);
    }

    const updated = await prisma.productionRecord.findUnique({ where: { id: record.id as string } });
    res.json(updated);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE single record
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const existing = await prisma.productionRecord.findFirst({
      where: { id: req.params.id as string, companyId }
    });

    if (!existing) return res.status(404).json({ error: 'Record not found' });

    await prisma.productionRecord.delete({
      where: { id: req.params.id as string }
    });

    // Rebalance shift after deletion
    await rebalanceShift(existing.productionDate, existing.machineId, existing.shiftId, companyId as string);

    res.status(204).send();
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// BULK DELETE records
router.post('/bulk-delete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs not provided' });

    // Find all unique contexts to rebalance later
    const records = await prisma.productionRecord.findMany({
      where: { id: { in: ids }, companyId },
      select: { productionDate: true, machineId: true, shiftId: true }
    });

    const contexts = Array.from(new Set(records.map(r => 
      `${r.productionDate.toISOString()}|${r.machineId}|${r.shiftId}`
    )));

    // Perform delete
    await prisma.productionRecord.deleteMany({
      where: { id: { in: ids as string[] }, companyId }
    });

    // Rebalance each context
    for (const ctx of contexts) {
      const [dateStr, machineId, shiftId] = ctx.split('|');
      await rebalanceShift(new Date(dateStr), machineId, shiftId, companyId);
    }

    res.status(204).send();
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Bulk silme basarisiz' });
  }
});

// BULK CREATE records (Manual bulk entry)
router.post('/bulk-entry', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { records } = req.body;
    if (!records || !Array.isArray(records)) return res.status(400).json({ error: 'Records not provided' });

    const createdRecords = [];
    const affectedContexts = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (const recordData of records) {
        const {
          productionDate,
          shiftId,
          machineId,
          operatorId,
          productId,
          producedQuantity,
          defectQuantity = 0,
          plannedDowntimeMinutes = 0, 
          notes = '',
          cycleTimeSeconds: providedCycleTime
        } = recordData;

        const product = await tx.product.findFirst({ where: { id: productId, companyId } });
        if (!product) throw new Error(`Product not found: ${productId}`);

        const cycleTimeSeconds = providedCycleTime || product.cycleTimeSeconds || 30;

        const shift = await tx.shift.findFirst({ where: { id: shiftId, companyId } });
        if (!shift) throw new Error(`Shift not found: ${shiftId}`);

        const oeeResult = await calculateOEE({
          producedQuantity,
          cycleTimeSeconds,
          plannedDowntimeMinutes, 
          defectQuantity,
          shiftDurationMinutes: shift.durationMinutes
        });

        const created = await tx.productionRecord.create({
          data: {
            companyId,
            productionDate: new Date(productionDate),
            shiftId,
            machineId,
            operatorId,
            productId,
            producedQuantity,
            actualDurationMinutes: oeeResult.actualDurationMinutes || 0,
            cycleTimeSeconds,
            plannedDowntimeMinutes,
            unplannedDowntimeMinutes: oeeResult.unplannedDowntimeMinutes || 0,
            downtimeMinutes: oeeResult.downtimeMinutes || 0,
            plannedDurationMinutes: oeeResult.plannedDurationMinutes,
            availability: oeeResult.availability,
            performance: oeeResult.performance,
            quality: oeeResult.quality,
            oee: oeeResult.oee,
            defectQuantity,
            plannedQuantity: oeeResult.plannedQuantity,
            notes
          }
        });
        createdRecords.push(created);
        affectedContexts.add(`${new Date(productionDate).toISOString()}|${machineId}|${shiftId}`);
      }
    });

    // Rebalance all affected contexts after transaction
    for (const ctx of Array.from(affectedContexts)) {
      const [dateStr, machineId, shiftId] = ctx.split('|');
      await rebalanceShift(new Date(dateStr), machineId, shiftId, companyId);
    }

    res.status(201).json({ success: true, count: createdRecords.length });
  } catch (error: any) {
    console.error('Bulk entry error:', error);
    res.status(500).json({ error: error.message || 'Toplu kayıt başarısız' });
  }
});

// This is used for the interactive grid save as well.
router.post('/recalculate-all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID missing' });

    // Find all unique (Date, Machine, Shift) contexts in the database for this company
    const uniqueContexts = await prisma.productionRecord.groupBy({
      by: ['productionDate', 'machineId', 'shiftId'],
      where: { companyId }
    });

    console.log(`GLOBAL RECALCULATION START: ${uniqueContexts.length} contexts for company ${companyId}`);

    // Process contexts in sequence to avoid overloading DB connections or calculations
    for (const ctx of uniqueContexts) {
      await rebalanceShift(ctx.productionDate, ctx.machineId, ctx.shiftId, companyId);
    }

    res.json({ success: true, count: uniqueContexts.length });
  } catch (error: any) {
    console.error('Global recalculate error:', error);
    res.status(500).json({ error: error.message || 'Tüm kayıtlar yeniden hesaplanamadı' });
  }
});

router.post('/bulk-update', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { updates } = req.body; 
    if (!updates || !Array.isArray(updates)) return res.status(400).json({ error: 'Updates not provided' });

    const affectedContexts = new Set<string>();

    for (const update of updates) {
      const { id, data } = update;
      const existing = await prisma.productionRecord.findFirst({ where: { id: id as string, companyId } });
      if (!existing) continue;

      const targetDate = data.productionDate ? new Date(data.productionDate) : existing.productionDate;
      const targetMachineId = data.machineId || existing.machineId;
      const targetShiftId = data.shiftId || existing.shiftId;

      affectedContexts.add(`${targetDate.toISOString()}|${targetMachineId}|${targetShiftId}`);
      if (existing.productionDate.getTime() !== targetDate.getTime() || 
          existing.machineId !== targetMachineId || 
          existing.shiftId !== targetShiftId) {
        affectedContexts.add(`${existing.productionDate.toISOString()}|${existing.machineId}|${existing.shiftId}`);
      }

      const { companyId: _cid, ...safeData } = data;
      console.log(`UPDATE RECORD ${id}: Context ${targetDate.toISOString()} | Mach ${targetMachineId} | Shift ${targetShiftId}`);

      await prisma.productionRecord.update({
        where: { id: id as string },
        data: {
          ...safeData,
          productionDate: targetDate,
          machineId: targetMachineId,
          shiftId: targetShiftId
        }
      });
    }

    for (const ctx of Array.from(affectedContexts)) {
      const [dateStr, machineId, shiftId] = ctx.split('|');
      await rebalanceShift(new Date(dateStr), machineId, shiftId, companyId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Bulk guncelleme basarisiz' });
  }
});

router.get('/average-cycle-time/:productId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const productId = req.params.productId as string;
    const companyId = getCompanyId(req);

    const records = await prisma.productionRecord.findMany({
      where: { productId, companyId: companyId as string },
      select: { cycleTimeSeconds: true, producedQuantity: true }
    });

    if (records.length === 0) {
      const product = await prisma.product.findFirst({ where: { id: productId, companyId: companyId as string } });
      return res.json({ averageCycleTime: product?.cycleTimeSeconds || 30 });
    }

    // Weighted Average Calculation: Sum(CycleTime * Produced) / Sum(Produced)
    // This gives more weight to records with higher production volumes (usually cleaner data)
    let totalWeightedTime = 0;
    let totalProduced = 0;

    records.forEach(r => {
      const qty = r.producedQuantity || 0;
      totalWeightedTime += (r.cycleTimeSeconds || 0) * qty;
      totalProduced += qty;
    });

    const weightedAvg = totalProduced > 0 ? totalWeightedTime / totalProduced : 0;
    
    // Safety check: if weightedAvg is 0, fallback to a simple mean or master data
    let finalAvg = weightedAvg;
    if (finalAvg <= 0) {
      const sum = records.reduce((acc, r) => acc + (r.cycleTimeSeconds || 0), 0);
      finalAvg = sum / records.length;
    }

    res.json({ averageCycleTime: finalAvg || 30 });
  } catch (error) {
    console.error('Average calc error:', error);
    res.status(500).json({ error: 'Ortalama hesaplanamadı' });
  }
});

export default router;
