import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const shifts = await prisma.shift.findMany({
      where: { companyId },
      orderBy: [{ displayOrder: 'asc' }, { shiftCode: 'asc' }],
    });
    res.json(shifts);
  } catch (error) { 
    console.error('[Shifts] Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' }); 
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const shift = await prisma.shift.findFirst({ where: { id: req.params.id as string, companyId: getCompanyId(req) as string } });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    res.json(shift);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch shift' }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const shift = await prisma.shift.create({ data: { ...req.body, companyId: getCompanyId(req) } });
    res.status(201).json(shift);
  } catch (error) { res.status(500).json({ error: 'Failed to create shift' }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { companyId, ...data } = req.body;
    const shift = await prisma.shift.update({ where: { id: req.params.id as string }, data });
    res.json(shift);
  } catch (error) { res.status(500).json({ error: 'Failed to update shift' }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.shift.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Failed to delete shift' }); }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    await prisma.$transaction(ids.map((id: string, index: number) => prisma.shift.update({ where: { id: id as string }, data: { displayOrder: index } })));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to reorder shifts' }); }
});

router.post('/bulk-delete', async (req: AuthRequest, res) => {
  const { ids } = req.body;
  try {
    await prisma.shift.deleteMany({ where: { id: { in: ids as string[] }, companyId: getCompanyId(req) } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu silme başarısız' }); }
});

router.post('/bulk-update-status', async (req: AuthRequest, res) => {
  const { ids, status } = req.body;
  try {
    await prisma.shift.updateMany({ where: { id: { in: ids as string[] }, companyId: getCompanyId(req) }, data: { status } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu durum güncelleme başarısız' }); }
});

router.post('/bulk-update', async (req: AuthRequest, res) => {
  const { updates } = req.body;
  try {
    await prisma.$transaction(updates.map((u: any) => {
      const { id, data: originalData } = u;
      const data: any = { ...originalData };
      if (data.durationMinutes !== undefined) { const num = parseInt(data.durationMinutes as string); if (!isNaN(num)) { data.durationMinutes = num; } else { delete data.durationMinutes; } }
      delete data.companyId;
      return prisma.shift.update({ where: { id: id as string }, data });
    }));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu düzenleme başarısız' }); }
});

export default router;
