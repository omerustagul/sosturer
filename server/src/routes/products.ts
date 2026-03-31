import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

router.get('/', async (req: AuthRequest, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { companyId: getCompanyId(req) },
      orderBy: [{ displayOrder: 'asc' }, { productCode: 'asc' }],
    });
    res.json(products);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch products' }); }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const product = await prisma.product.findFirst({ where: { id: req.params.id as string, companyId: getCompanyId(req) as string } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch product' }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const product = await prisma.product.create({ data: { ...req.body, companyId: getCompanyId(req) } });
    res.status(201).json(product);
  } catch (error) { res.status(500).json({ error: 'Failed to create product' }); }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { companyId, ...data } = req.body;
    const product = await prisma.product.update({ where: { id: req.params.id as string }, data });
    res.json(product);
  } catch (error) { res.status(500).json({ error: 'Failed to update product' }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Failed to delete product' }); }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    await prisma.$transaction(ids.map((id: string, index: number) => prisma.product.update({ where: { id: id as string }, data: { displayOrder: index } })));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to reorder products' }); }
});

router.post('/bulk-delete', async (req: AuthRequest, res) => {
  const { ids } = req.body;
  try {
    await prisma.product.deleteMany({ where: { id: { in: ids as string[] }, companyId: getCompanyId(req) } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu silme başarısız' }); }
});

router.post('/bulk-update-status', async (req: AuthRequest, res) => {
  const { ids, status } = req.body;
  try {
    await prisma.product.updateMany({ where: { id: { in: ids as string[] }, companyId: getCompanyId(req) }, data: { status } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu güncelleme başarısız' }); }
});

router.post('/bulk-update', async (req: AuthRequest, res) => {
  const { updates } = req.body;
  try {
    await prisma.$transaction(updates.map((u: any) => {
      const { id, data: originalData } = u;
      const { companyId, ...data } = originalData;
      return prisma.product.update({ where: { id: id as string }, data });
    }));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu düzenleme başarısız' }); }
});

export default router;
