import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

router.get('/', async (req: AuthRequest, res) => {
  try {
    const machines = await prisma.machine.findMany({
      where: { companyId: getCompanyId(req) },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(machines);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch machines' }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const machine = await prisma.machine.findFirst({ where: { id: req.params.id as string, companyId: getCompanyId(req) } });
    if (!machine) return res.status(404).json({ error: 'Machine not found' });
    res.json(machine);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch machine' }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const machine = await prisma.machine.create({ data: { ...req.body, companyId: getCompanyId(req) } });
    res.status(201).json(machine);
  } catch (error) {
    console.error('Error creating machine:', error);
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { companyId, ...data } = req.body;
    const machine = await prisma.machine.update({ where: { id: req.params.id as string }, data });
    res.json(machine);
  } catch (error) { res.status(500).json({ error: 'Failed to update machine' }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.machine.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Failed to delete machine' }); }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    await prisma.$transaction(ids.map((id: string, index: number) => prisma.machine.update({ where: { id: id as string }, data: { displayOrder: index } })));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to reorder machines' }); }
});

router.post('/bulk-delete', async (req: AuthRequest, res) => {
  const { ids } = req.body;
  try {
    await prisma.machine.deleteMany({ where: { id: { in: ids as string[] }, companyId: getCompanyId(req) } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu silme başarısız' }); }
});

router.post('/bulk-update-status', async (req: AuthRequest, res) => {
  const { ids, status } = req.body;
  try {
    await prisma.machine.updateMany({ where: { id: { in: ids as string[] }, companyId: getCompanyId(req) }, data: { status } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu güncelleme başarısız' }); }
});

router.post('/bulk-update', async (req: AuthRequest, res) => {
  const { updates } = req.body;
  try {
    await prisma.$transaction(updates.map((u: any) => {
      const { id, data: originalData } = u;
      const data: any = {};
      for (const [key, value] of Object.entries(originalData)) {
        if (key === 'installedDate') { data.installedDate = value ? new Date(value as string) : null; }
        else if (key === 'capacityPerShift') { const num = parseInt(value as string); data.capacityPerShift = !isNaN(num) ? num : null; }
        else if (key !== 'companyId') { data[key] = value; }
      }
      return prisma.machine.update({ where: { id: id as string }, data });
    }));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu düzenleme başarısız' }); }
});

export default router;
