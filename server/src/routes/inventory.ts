import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// WAREHOUSE ROUTES
router.get('/warehouses', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const warehouses = await prisma.warehouse.findMany({
      where: { companyId },
      include: {
        _count: { select: { stockLevels: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ error: 'Depolar getirilemedi' });
  }
});

router.post('/warehouses', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { name, type, status, unitId } = req.body;
    const warehouse = await prisma.warehouse.create({
      data: { companyId, name, type: type || 'general', status: status || 'active', unitId: unitId || null }
    });
    res.status(201).json(warehouse);
  } catch (error) {
    res.status(500).json({ error: 'Depo oluşturulamadı' });
  }
});

router.put('/warehouses/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { id } = req.params;
    const { name, type, status, unitId } = req.body;
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        name,
        type,
        status,
        unitId: unitId !== undefined ? (unitId || null) : undefined
      }
    });
    res.json(warehouse);
  } catch (error) {
    res.status(500).json({ error: 'Depo güncellenemedi' });
  }
});

router.delete('/warehouses/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.warehouse.delete({ where: { id } });
    res.json({ success: true, message: 'Depo silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Depo silinemedi - bağlı stok hareketleri olabilir' });
  }
});

// STOCK LEVEL ROUTES
router.get('/levels', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const levels = await prisma.stockLevel.findMany({
      where: { companyId },
      include: {
        product: { select: { productCode: true, productName: true, productGroup: true } },
        warehouse: { select: { name: true, type: true } }
      }
    });
    res.json(levels);
  } catch (error) {
    res.status(500).json({ error: 'Stok seviyeleri getirilemedi' });
  }
});

// STOCK MOVEMENT ROUTES
router.get('/movements', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const movements = await prisma.stockMovement.findMany({
      where: { companyId },
      include: {
        product: { select: { productCode: true, productName: true } },
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Stok hareketleri getirilemedi' });
  }
});

router.post('/movements', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { productId, fromWarehouseId, toWarehouseId, quantity, type, description, referenceId } = req.body;

    // Transaction to update movement and stock levels (Atomic)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create movement
      const movement = await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity,
          type,
          description,
          referenceId
        }
      });

      // 2. Decrease source warehouse stock
      if (fromWarehouseId) {
        await tx.stockLevel.upsert({
          where: { productId_warehouseId: { productId, warehouseId: fromWarehouseId } },
          update: { quantity: { decrement: quantity } },
          create: { companyId, productId, warehouseId: fromWarehouseId, quantity: -quantity }
        });
      }

      // 3. Increase destination warehouse stock
      if (toWarehouseId) {
        await tx.stockLevel.upsert({
          where: { productId_warehouseId: { productId, warehouseId: toWarehouseId } },
          update: { quantity: { increment: quantity } },
          create: { companyId, productId, warehouseId: toWarehouseId, quantity: quantity }
        });
      }

      return movement;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Movement error:', error);
    res.status(500).json({ error: 'Stok hareketi işlenemedi' });
  }
});

export default router;
