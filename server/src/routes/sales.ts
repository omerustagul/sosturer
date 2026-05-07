import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// CUSTOMER ROUTES
router.get('/customers', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const customers = await prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: 'asc' }
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Müşteri/Bayi getirilemedi' });
  }
});

router.post('/customers', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { name, email, phone, address, taxOffice, taxNumber } = req.body;
    const customer = await prisma.customer.create({
      data: { companyId, name, email, phone, address, taxOffice, taxNumber }
    });
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Müşteri/Bayi oluşturulamadı' });
  }
});

// ORDER ROUTES
router.get('/orders', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const orders = await prisma.order.findMany({
      where: { companyId },
      include: {
        customer: { select: { name: true } },
        orderItems: {
          include: { product: { select: { productCode: true, productName: true } } }
        }
      },
      orderBy: { orderDate: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Siparişler getirilemedi' });
  }
});

router.post('/orders', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const { customerId, orderNumber, orderDate, dueDate, notes, items } = req.body;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          companyId,
          customerId,
          orderNumber,
          orderDate: new Date(orderDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          notes,
          orderItems: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          }
        },
        include: { orderItems: true }
      });
      return newOrder;
    });

    res.status(201).json(order);
  } catch (error: any) {
    console.error('Order error:', error);
    res.status(500).json({ error: 'Sipariş oluşturulamadı' });
  }
});

router.put('/orders/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req) as string;
    if (!companyId) return res.status(401).json({ error: 'Yetkisiz erişim' });

    const { status } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get order with items
      const order = await tx.order.findUnique({
        where: { id: req.params.id as string, companyId },
        include: { orderItems: { include: { product: true } } }
      });

      if (!order) throw new Error('Sipariş bulunamadı');

      // 2. If moving TO shipped/completed and wasn't before
      const isNowShipped = (status === 'shipped' || status === 'completed');
      const wasShipped = (order.status === 'shipped' || order.status === 'completed');

      if (isNowShipped && !wasShipped) {
        for (const item of order.orderItems) {
          // Find a warehouse to ship from (default to product's target warehouse or first 'finished' warehouse)
          let warehouseId = item.product.targetWarehouseId;
          
          if (!warehouseId) {
            const finishedWarehouse = await tx.warehouse.findFirst({
              where: { companyId, type: 'finished' }
            });
            warehouseId = finishedWarehouse?.id;
          }

          if (warehouseId) {
            // Decrement stock (lotsuz for now as sales order items don't have lot)
            await tx.stockLevel.upsert({
              where: {
                productId_toolTypeId_equipmentTypeId_warehouseId_lotNumber: {
                  productId: item.productId,
                  toolTypeId: null,
                  equipmentTypeId: null,
                  warehouseId: warehouseId,
                  lotNumber: ""
                }
              },
              update: { quantity: { decrement: item.quantity } },
              create: {
                companyId,
                productId: item.productId,
                warehouseId: warehouseId,
                lotNumber: "",
                quantity: -item.quantity
              }
            });

            // Create movement
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: item.productId,
                fromWarehouseId: warehouseId,
                quantity: item.quantity,
                type: 'SALE',
                referenceId: order.orderNumber,
                description: `Sipariş Sevkiyatı - No: ${order.orderNumber}`
              }
            });
          }
        }
      }

      // 3. Update status
      return await tx.order.update({
        where: { id: req.params.id as string, companyId },
        data: { status }
      });
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Sipariş durumu güncellenemedi' });
  }
});

export default router;
