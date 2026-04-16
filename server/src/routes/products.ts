import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const products = await prisma.product.findMany({
      where: { companyId },
      include: {
        route: { include: { steps: { include: { operation: true } } } },
        defaultComponents: { include: { componentProduct: true } },
        defaultMachines: { include: { machine: true } }
      },
      orderBy: [{ displayOrder: 'asc' }, { productCode: 'asc' }],
    });
    res.json(products);
  } catch (error) { 
    console.error('[Products] Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch products' }); 
  }
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
    const { 
      id, companyId, createdAt, updatedAt, 
      route, recipes, routeId, 
      defaultComponents, defaultMachines, // Relation inputs
      ...data 
    } = req.body;
    
    const company_id = getCompanyId(req);
    const createData: any = { 
      ...data, 
      companyId: company_id
    };

    if (routeId) {
      createData.route = { connect: { id: routeId } };
    }

    if (defaultComponents && Array.isArray(defaultComponents)) {
      createData.defaultComponents = {
        create: defaultComponents.map((c: any) => ({
          ...c,
          companyId: company_id,
          id: undefined // Let prisma generate it
        }))
      };
    }

    if (defaultMachines && Array.isArray(defaultMachines)) {
      createData.defaultMachines = {
        create: defaultMachines.map((m: any) => ({
          ...m,
          companyId: company_id,
          id: undefined
        }))
      };
    }

    const product = await prisma.product.create({ 
      data: createData
    });
    res.status(201).json(product);
  } catch (error) { 
    console.error('[Products] Create error:', error);
    res.status(500).json({ error: 'Failed to create product' }); 
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { 
      id, companyId, createdAt, updatedAt, 
      route, recipes, productionOrders, 
      routeId, 
      defaultComponents, defaultMachines, // Extract relations
      ...updateData 
    } = req.body;

    const company_id = getCompanyId(req);
    const data: any = { ...updateData };
    
    if (routeId) {
      data.route = { connect: { id: routeId } };
    } else if (routeId === null) {
      data.route = { disconnect: true };
    }

    // Sync default components
    if (defaultComponents && Array.isArray(defaultComponents)) {
      data.defaultComponents = {
        deleteMany: {},
        create: defaultComponents.map((c: any) => ({
          componentProductId: c.componentProductId,
          warehouseId: c.warehouseId || null,
          lotNumber: c.lotNumber || null,
          quantity: Number(c.quantity) || 0,
          consumptionType: c.consumptionType || 'UNIT',
          unit: c.unit || 'PCS',
          notes: c.notes || '',
          companyId: company_id
        }))
      };
    }

    // Sync default machines
    if (defaultMachines && Array.isArray(defaultMachines)) {
      data.defaultMachines = {
        deleteMany: {},
        create: defaultMachines.map((m: any) => ({
          machineId: m.machineId,
          unitTimeSeconds: Number(m.unitTimeSeconds) || 0,
          companyId: company_id
        }))
      };
    }

    const product = await prisma.product.update({ 
      where: { id: req.params.id as string }, 
      data
    });
    res.json(product);
  } catch (error) { 
    console.error('[Products] Update error:', error);
    res.status(500).json({ error: 'Failed to update product' }); 
  }
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
      const { 
        id: _id, companyId, createdAt, updatedAt, 
        route, recipes, routeId, ...data 
      } = originalData;

      const updateData: any = { ...data };
      if (routeId) {
        updateData.route = { connect: { id: routeId } };
      } else if (routeId === null) {
        updateData.route = { disconnect: true };
      }

      return prisma.product.update({ 
        where: { id: id as string }, 
        data: updateData
      });
    }));
    res.json({ success: true });
  } catch (error) { 
    console.error('[Products] Bulk update error:', error);
    res.status(500).json({ error: 'Toplu düzenleme başarısız' }); 
  }
});

export default router;
