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
      orderBy: { displayOrder: 'asc' }
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

    const { name, code, type, status, unitId, locationId } = req.body;
    const warehouse = await (prisma as any).warehouse.create({
      data: { 
        companyId, 
        name, 
        code: code || null,
        type: type || 'general', 
        status: status || 'active', 
        unitId: unitId || null,
        locationId: locationId || null
      }
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
    const { name, code, type, status, unitId, locationId } = req.body;
    const warehouse = await (prisma as any).warehouse.update({
      where: { id: id as string },
      data: {
        name,
        code: code !== undefined ? (code || null) : undefined,
        type,
        status,
        unitId: unitId !== undefined ? (unitId || null) : undefined,
        locationId: locationId !== undefined ? (locationId || null) : undefined
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
    await prisma.warehouse.delete({ where: { id: id as string } });
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
          where: { productId_warehouseId_lotNumber: { productId, warehouseId: fromWarehouseId, lotNumber: "" } },
          update: { quantity: { decrement: quantity } },
          create: { companyId, productId, warehouseId: fromWarehouseId, quantity: -quantity }
        });
      }

      // 3. Increase destination warehouse stock
      if (toWarehouseId) {
        await tx.stockLevel.upsert({
          where: { productId_warehouseId_lotNumber: { productId, warehouseId: toWarehouseId, lotNumber: "" } },
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

router.post('/warehouses/bulk-update', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { updates } = req.body;
    
    await prisma.$transaction(
      updates.map((u: any) => {
        const { id, data: originalData } = u;
        const { company, createdAt, updatedAt, _count, ...rest } = originalData;
        return prisma.warehouse.update({
          where: { id, companyId },
          data: rest
        });
      })
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu güncelleme başarısız oldu' });
  }
});

router.post('/warehouses/bulk-delete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids } = req.body;
    await prisma.warehouse.deleteMany({
      where: { id: { in: ids }, companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu silme başarısız oldu' });
  }
});

router.post('/warehouses/reorder', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Geçersiz veri' });

    await Promise.all(
      ids.map((id: string, index: number) =>
        prisma.warehouse.update({
          where: { id },
          data: { displayOrder: index }
        })
      )
    );
    res.json({ message: 'Sıralama güncellendi' });
  } catch (error) {
    res.status(500).json({ error: 'Sıralama güncellenemedi' });
  }
});

router.post('/warehouses/bulk-update-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { ids, status } = req.body;
    await prisma.warehouse.updateMany({
      where: { id: { in: ids }, companyId },
      data: { status }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Toplu durum güncelleme başarısız oldu' });
  }
});

// GET LOTS for product and warehouse
router.get('/lots', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { productId, warehouseId } = req.query;

    const levels = await prisma.stockLevel.findMany({
      where: { 
        companyId: companyId as string,
        productId: productId as string,
        warehouseId: warehouseId as string,
        quantity: { gt: 0 }
      },
      select: { lotNumber: true, quantity: true }
    });
    res.json(levels);
  } catch (error) {
    res.status(500).json({ error: 'Lotlar getirilemedi' });
  }
});

export default router;
