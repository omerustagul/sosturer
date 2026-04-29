import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId as string;

const VALID_STATUSES = new Set(['pending', 'available', 'used']);
const MOVEMENT_TYPE = 'CONSUMPTION_TRANSACTION';

const transactionInclude = {
  type: { select: { id: true, code: true, name: true } },
  product: { select: { id: true, productCode: true, productName: true, unitOfMeasure: true } },
  warehouse: { select: { id: true, code: true, name: true, type: true } },
  productionOrders: {
    include: {
      productionOrder: {
        select: {
          id: true,
          recordNumber: true,
          lotNumber: true,
          status: true,
          quantity: true,
          product: { select: { productCode: true, productName: true } }
        }
      }
    },
    orderBy: { id: 'asc' }
  }
};

const getNextTransactionNo = async (tx: any, companyId: string) => {
  const latest = await tx.consumptionTransaction.findFirst({
    where: { companyId },
    select: { transactionNo: true },
    orderBy: { transactionNo: 'desc' }
  });

  const lastNumber = latest?.transactionNo?.match(/^TK(\d{6})$/)?.[1];
  const nextNumber = lastNumber ? Number(lastNumber) + 1 : 1;
  return `TK${String(nextNumber).padStart(6, '0')}`;
};

const normalizePayload = (body: any) => {
  const quantity = Number(body.quantity);
  const status = String(body.status || 'pending');

  if (!body.typeId) throw new Error('Tuketim tipi secilmelidir');
  if (!body.productId) throw new Error('Stok kodu secilmelidir');
  if (!body.warehouseId) throw new Error('Depo secilmelidir');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Miktar 0dan buyuk olmalidir');
  if (!VALID_STATUSES.has(status)) throw new Error('Gecersiz durum');

  return {
    typeId: String(body.typeId),
    transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
    status,
    productId: String(body.productId),
    warehouseId: String(body.warehouseId),
    lotNumber: String(body.lotNumber || '').trim(),
    serialNo: body.serialNo ? String(body.serialNo).trim() : null,
    personnelName: body.personnelName ? String(body.personnelName).trim() : null,
    quantity,
    unit: body.unit ? String(body.unit).trim() : null,
    notes: body.notes ? String(body.notes).trim() : null,
    orderIds: Array.from(new Set(Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean).map(String) : []))
  };
};

const validateReferences = async (tx: any, companyId: string, payload: any) => {
  const [type, product, warehouse] = await Promise.all([
    tx.consumptionType.findFirst({ where: { id: payload.typeId, companyId }, select: { id: true } }),
    tx.product.findFirst({ where: { id: payload.productId, companyId }, select: { id: true, unitOfMeasure: true } }),
    tx.warehouse.findFirst({ where: { id: payload.warehouseId, companyId }, select: { id: true } })
  ]);

  if (!type) throw new Error('Secilen tuketim tipi bulunamadi');
  if (!product) throw new Error('Secilen stok karti bulunamadi');
  if (!warehouse) throw new Error('Secilen depo bulunamadi');

  if (payload.orderIds.length > 0) {
    const orderCount = await tx.productionOrder.count({
      where: { id: { in: payload.orderIds }, companyId }
    });
    if (orderCount !== payload.orderIds.length) throw new Error('Secilen uretim emirlerinden biri bulunamadi');
  }

  return { product };
};

const applyStock = async (tx: any, companyId: string, transaction: any) => {
  const currentLevel = await tx.stockLevel.findUnique({
    where: {
      productId_warehouseId_lotNumber: {
        productId: transaction.productId,
        warehouseId: transaction.warehouseId,
        lotNumber: transaction.lotNumber || ''
      }
    }
  });

  if (!currentLevel || currentLevel.quantity < transaction.quantity) {
    throw new Error(`Yetersiz stok: ${transaction.lotNumber || 'Lotsuz'} giris no icin mevcut miktar tuketimden az`);
  }

  await tx.stockLevel.update({
    where: {
      productId_warehouseId_lotNumber: {
        productId: transaction.productId,
        warehouseId: transaction.warehouseId,
        lotNumber: transaction.lotNumber || ''
      }
    },
    data: { quantity: { decrement: transaction.quantity } }
  });

  await tx.stockMovement.create({
    data: {
      companyId,
      productId: transaction.productId,
      fromWarehouseId: transaction.warehouseId,
      lotNumber: transaction.lotNumber || '',
      quantity: transaction.quantity,
      type: MOVEMENT_TYPE,
      referenceId: transaction.transactionNo,
      description: `Tuketim islemi - ${transaction.transactionNo}`
    }
  });
};

const reverseStock = async (tx: any, companyId: string, transaction: any) => {
  await tx.stockLevel.upsert({
    where: {
      productId_warehouseId_lotNumber: {
        productId: transaction.productId,
        warehouseId: transaction.warehouseId,
        lotNumber: transaction.lotNumber || ''
      }
    },
    update: { quantity: { increment: transaction.quantity } },
    create: {
      companyId,
      productId: transaction.productId,
      warehouseId: transaction.warehouseId,
      lotNumber: transaction.lotNumber || '',
      quantity: transaction.quantity
    }
  });

  await tx.stockMovement.deleteMany({
    where: {
      companyId,
      referenceId: transaction.transactionNo,
      type: MOVEMENT_TYPE
    }
  });
};

const resolveLookupParam = (param: string) => {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  return {
    OR: [
      ...(isUUID ? [{ id: param }] : []),
      { transactionNo: { equals: param, mode: 'insensitive' } }
    ]
  };
};

router.get('/next-number', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    const transactionNo = await getNextTransactionNo(prisma as any, companyId);
    res.json({ transactionNo });
  } catch (error) {
    res.status(500).json({ error: 'Tuketim numarasi uretilemedi' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const { search, status, typeId, productId, warehouseId, startDate, endDate, take } = req.query;
    const where: any = { companyId };
    const andFilters: any[] = [];

    if (status && status !== 'all') where.status = String(status);
    if (typeId && typeId !== 'all') where.typeId = String(typeId);
    if (productId && productId !== 'all') where.productId = String(productId);
    if (warehouseId && warehouseId !== 'all') where.warehouseId = String(warehouseId);

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setDate(end.getDate() + 1);
        where.transactionDate.lt = end;
      }
    }

    if (search) {
      andFilters.push({
        OR: [
          { transactionNo: { contains: String(search), mode: 'insensitive' } },
          { lotNumber: { contains: String(search), mode: 'insensitive' } },
          { serialNo: { contains: String(search), mode: 'insensitive' } },
          { notes: { contains: String(search), mode: 'insensitive' } },
          { type: { is: { name: { contains: String(search), mode: 'insensitive' } } } },
          { product: { is: { productCode: { contains: String(search), mode: 'insensitive' } } } },
          { product: { is: { productName: { contains: String(search), mode: 'insensitive' } } } },
          { warehouse: { is: { name: { contains: String(search), mode: 'insensitive' } } } }
        ]
      });
    }

    if (andFilters.length > 0) where.AND = andFilters;
    const takeValue = Math.min(Math.max(Number(take) || 1000, 1), 5000);

    const transactions = await (prisma as any).consumptionTransaction.findMany({
      where,
      include: transactionInclude,
      orderBy: { transactionDate: 'desc' },
      take: takeValue
    });
    res.json(transactions);
  } catch (error) {
    console.error('[ConsumptionTransactions] Fetch error:', error);
    res.status(500).json({ error: 'Tuketim islemleri getirilemedi' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const transaction = await (prisma as any).consumptionTransaction.findFirst({
      where: { companyId, ...resolveLookupParam(String(req.params.id)) },
      include: transactionInclude
    });
    if (!transaction) return res.status(404).json({ error: 'Tuketim islemi bulunamadi' });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Tuketim detayi getirilemedi' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    const payload = normalizePayload(req.body);

    const result = await prisma.$transaction(async (tx) => {
      await validateReferences(tx as any, companyId, payload);
      const transactionNo = await getNextTransactionNo(tx as any, companyId);

      const transaction = await (tx as any).consumptionTransaction.create({
        data: {
          companyId,
          transactionNo,
          typeId: payload.typeId,
          transactionDate: payload.transactionDate,
          status: payload.status,
          productId: payload.productId,
          warehouseId: payload.warehouseId,
          lotNumber: payload.lotNumber,
          serialNo: payload.serialNo,
          personnelName: payload.personnelName || req.user?.fullName || req.user?.email || null,
          createdByUserId: req.user?.id || null,
          quantity: payload.quantity,
          unit: payload.unit,
          notes: payload.notes,
          stockApplied: false,
          productionOrders: {
            create: payload.orderIds.map((productionOrderId: string) => ({ productionOrderId }))
          }
        }
      });

      if (payload.status === 'used') {
        await applyStock(tx as any, companyId, transaction);
        await (tx as any).consumptionTransaction.update({
          where: { id: transaction.id },
          data: { stockApplied: true }
        });
      }

      return (tx as any).consumptionTransaction.findUnique({
        where: { id: transaction.id },
        include: transactionInclude
      });
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('[ConsumptionTransactions] Create error:', error);
    res.status(400).json({ error: error.message || 'Tuketim islemi olusturulamadi' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });
    const payload = normalizePayload(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await (tx as any).consumptionTransaction.findFirst({
        where: { companyId, ...resolveLookupParam(String(req.params.id)) },
        include: { productionOrders: true }
      });
      if (!existing) throw new Error('Tuketim islemi bulunamadi');

      if (existing.stockApplied) {
        await reverseStock(tx as any, companyId, existing);
      }

      await validateReferences(tx as any, companyId, payload);
      await (tx as any).consumptionTransactionOrder.deleteMany({
        where: { consumptionTransactionId: existing.id }
      });

      const updated = await (tx as any).consumptionTransaction.update({
        where: { id: existing.id },
        data: {
          typeId: payload.typeId,
          transactionDate: payload.transactionDate,
          status: payload.status,
          productId: payload.productId,
          warehouseId: payload.warehouseId,
          lotNumber: payload.lotNumber,
          serialNo: payload.serialNo,
          personnelName: payload.personnelName || existing.personnelName || req.user?.fullName || req.user?.email || null,
          quantity: payload.quantity,
          unit: payload.unit,
          notes: payload.notes,
          stockApplied: false,
          productionOrders: {
            create: payload.orderIds.map((productionOrderId: string) => ({ productionOrderId }))
          }
        }
      });

      if (payload.status === 'used') {
        await applyStock(tx as any, companyId, updated);
        await (tx as any).consumptionTransaction.update({
          where: { id: updated.id },
          data: { stockApplied: true }
        });
      }

      return (tx as any).consumptionTransaction.findUnique({
        where: { id: existing.id },
        include: transactionInclude
      });
    });

    res.json(result);
  } catch (error: any) {
    console.error('[ConsumptionTransactions] Update error:', error);
    res.status(400).json({ error: error.message || 'Tuketim islemi guncellenemedi' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Sirket ID eksik' });

    await prisma.$transaction(async (tx) => {
      const existing = await (tx as any).consumptionTransaction.findFirst({
        where: { companyId, ...resolveLookupParam(String(req.params.id)) }
      });
      if (!existing) throw new Error('Tuketim islemi bulunamadi');

      if (existing.stockApplied) {
        await reverseStock(tx as any, companyId, existing);
      }

      await (tx as any).consumptionTransactionOrder.deleteMany({
        where: { consumptionTransactionId: existing.id }
      });
      await (tx as any).consumptionTransaction.delete({ where: { id: existing.id } });
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Tuketim islemi silinemedi' });
  }
});

export default router;
