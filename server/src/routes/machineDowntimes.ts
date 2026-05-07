import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const downtimes = await prisma.machineDowntime.findMany({
      where: { companyId },
      include: {
        machine: true,
        operator: true,
        shift: true,
        reason: true,
        productionOrder: true
      },
      orderBy: { date: 'desc' }
    });
    res.json(downtimes);
  } catch (error) {
    console.error('[MachineDowntimes] Fetch error:', error);
    res.status(500).json({ error: 'Makine duruşları getirilemedi' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { 
      date, 
      machineId, 
      operatorId, 
      shiftId, 
      durationMinutes, 
      reasonId, 
      productionOrderId, 
      notes 
    } = req.body;

    const downtime = await prisma.machineDowntime.create({
      data: {
        companyId,
        date: new Date(date),
        machineId,
        operatorId: operatorId || null,
        shiftId: shiftId || null,
        durationMinutes: Number(durationMinutes),
        reasonId,
        productionOrderId: productionOrderId || null,
        notes: notes || null
      },
      include: {
        machine: true,
        operator: true,
        shift: true,
        reason: true,
        productionOrder: true
      }
    });
    res.status(201).json(downtime);
  } catch (error: any) {
    console.error('[MachineDowntimes] Create error:', error);
    res.status(400).json({ error: error.message || 'Makine duruşu olusturulamadi' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { 
      date, 
      machineId, 
      operatorId, 
      shiftId, 
      durationMinutes, 
      reasonId, 
      productionOrderId, 
      notes 
    } = req.body;

    const downtime = await prisma.machineDowntime.update({
      where: { id: req.params.id },
      data: {
        date: date ? new Date(date) : undefined,
        machineId,
        operatorId: operatorId || null,
        shiftId: shiftId || null,
        durationMinutes: durationMinutes !== undefined ? Number(durationMinutes) : undefined,
        reasonId,
        productionOrderId: productionOrderId || null,
        notes: notes || null
      },
      include: {
        machine: true,
        operator: true,
        shift: true,
        reason: true,
        productionOrder: true
      }
    });
    res.json(downtime);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Makine duruşu guncellenemedi' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    await prisma.machineDowntime.deleteMany({ where: { id: req.params.id, companyId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Makine duruşu silinemedi' });
  }
});

export default router;
