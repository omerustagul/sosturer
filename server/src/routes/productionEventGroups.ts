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
    const groups = await prisma.productionEventGroup.findMany({
      where: { companyId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }]
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Olay grupları getirilemedi' });
  }
});

// POST new
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const { code, name, status } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'İsim alanı zorunludur' });
    }

    const group = await prisma.productionEventGroup.create({
      data: {
        companyId,
        code,
        name,
        status: status || 'active'
      }
    });
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: 'Olay grubu oluşturulamadı' });
  }
});

// PUT update
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    const { code, name, status } = req.body;

    const group = await prisma.productionEventGroup.update({
      where: { id, companyId },
      data: { code, name, status }
    });
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: 'Olay grubu güncellenemedi' });
  }
});

// DELETE
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;

    await prisma.productionEventGroup.delete({
      where: { id, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Olay grubu silinemedi' });
  }
});

// BULK DELETE
router.post('/bulk-delete', async (req: AuthRequest, res: Response) => {
  const { ids } = req.body;
  try {
    const companyId = getCompanyId(req);
    await prisma.productionEventGroup.deleteMany({
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
        prisma.productionEventGroup.update({
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
        prisma.productionEventGroup.update({
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
