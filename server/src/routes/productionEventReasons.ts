import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Get company ID from request
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

// GET list
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const reasons = await prisma.productionEventReason.findMany({
      where: { companyId },
      include: { group: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(reasons);
  } catch (error) {
    res.status(500).json({ error: 'Olay sebepleri getirilemedi' });
  }
});

// POST new
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const { code, name, type, status, groupId } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'İsim ve tip alanları zorunludur' });
    }

    const lastItem = await prisma.productionEventReason.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const reason = await prisma.productionEventReason.create({
      data: {
        companyId,
        code,
        name,
        type,
        status: status || 'active',
        groupId: groupId || null,
        displayOrder: nextOrder
      }
    });
    res.json(reason);
  } catch (error) {
    res.status(400).json({ error: 'Olay sebebi oluşturulamadı' });
  }
});

// PUT update
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    const { code, name, type, status, groupId } = req.body;

    const reason = await prisma.productionEventReason.update({
      where: { id, companyId },
      data: { code, name, type, status, groupId: groupId || null }
    });
    res.json(reason);
  } catch (error) {
    res.status(400).json({ error: 'Olay sebebi güncellenemedi' });
  }
});

// DELETE
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;

    await prisma.productionEventReason.delete({
      where: { id, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Olay sebebi silinemedi' });
  }
});

// BULK DELETE
router.post('/bulk-delete', async (req: AuthRequest, res: Response) => {
  const { ids } = req.body;
  try {
    const companyId = getCompanyId(req);
    await prisma.productionEventReason.deleteMany({
      where: { id: { in: ids }, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Toplu silme başarısız' });
  }
});

// BULK UPDATE
router.post('/bulk-update', async (req: AuthRequest, res: Response) => {
  const { updates } = req.body;
  try {
    const companyId = getCompanyId(req);
    await prisma.$transaction(
      updates.map((u: any) =>
        prisma.productionEventReason.update({
          where: { id: u.id, companyId },
          data: u.data
        })
      )
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Toplu güncelleme başarısız' });
  }
});

// REORDER
router.post('/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    const companyId = getCompanyId(req);
    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.productionEventReason.update({
          where: { id, companyId },
          data: { displayOrder: index }
        })
      )
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Sıralama kaydedilemedi' });
  }
});

export default router;
