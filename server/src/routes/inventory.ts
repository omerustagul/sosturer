import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import exceljs from 'exceljs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

router.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms\n`;
    try {
      fs.appendFileSync('c:\\dev\\Sosturer\\server\\api_debug.log', log);
    } catch (e) { }
  });
  next();
});

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// Get available lots for a product in a warehouse
router.get('/lots', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { productId, warehouseId } = req.query;

    if (!productId || !warehouseId) {
      return res.status(400).json({ error: 'Product ID and Warehouse ID are required' });
    }

    const levels = await (prisma as any).stockLevel.findMany({
      where: {
        companyId,
        productId: String(productId),
        warehouseId: String(warehouseId),
        quantity: { gt: 0 }
      },
      orderBy: { lotNumber: 'asc' }
    });

    res.json(levels);
  } catch (error) {
    res.status(500).json({ error: 'Lot bilgileri getirilemedi' });
  }
});

const STOCK_VOUCHER_TYPES: Record<string, { label: string; direction: 1 | -1; movementType: string }> = {
  ENTRY: { label: 'Giriş', direction: 1, movementType: 'STOCK_VOUCHER_ENTRY' },
  EXIT: { label: 'Çıkış', direction: -1, movementType: 'STOCK_VOUCHER_EXIT' },
  TRANSFER: { label: 'Transfer', direction: -1, movementType: 'TRANSFER' },
  COUNT_SURPLUS: { label: 'Sayım Fazlası', direction: -1, movementType: 'STOCK_COUNT_SURPLUS' },
  COUNT_SHORTAGE: { label: 'Sayım Eksiği', direction: 1, movementType: 'STOCK_COUNT_SHORTAGE' },
  SCRAP: { label: 'Fire', direction: -1, movementType: 'SCRAP' },
  RESERVE: { label: 'Rezerve', direction: -1, movementType: 'RESERVE' },
  IMPORT_ENTRY: { label: 'İthalat Girişi', direction: 1, movementType: 'IMPORT_ENTRY' },
  EXPORT_EXIT: { label: 'İhracat Çıkışı', direction: -1, movementType: 'EXPORT_EXIT' },
  CONSIGNMENT_ENTRY: { label: 'Konsinye Girişi', direction: 1, movementType: 'CONSIGNMENT_ENTRY' },
  CONSIGNMENT_EXIT: { label: 'Konsinye Çıkışı', direction: -1, movementType: 'CONSIGNMENT_EXIT' },
  CONSUMPTION_EXIT: { label: 'Tüketim Çıkışı', direction: -1, movementType: 'CONSUMPTION_EXIT' }
};

const CONTROL_STATUSES = new Set(['pending', 'in_control', 'rejected', 'accepted']);

const voucherInclude = {
  firm: { select: { id: true, name: true, code: true } },
  warehouse: { select: { id: true, name: true, code: true, type: true } },
  targetWarehouse: { select: { id: true, name: true, code: true, type: true } },
  items: {
    include: {
      product: { select: { id: true, productCode: true, productName: true, unitOfMeasure: true } }
    },
    orderBy: { createdAt: 'asc' }
  }
};

const voucherUploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/stock-vouchers');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const safeName = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `stock_voucher_${Date.now()}_${safeName}.pdf`);
  }
});

const voucherUpload = multer({
  storage: voucherUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';
    if (!isPdf) return cb(new Error('Sadece PDF dosyası yüklenebilir'));
    cb(null, true);
  }
});

const getNextVoucherNo = async (tx: any, companyId: string) => {
  const latest = await tx.stockVoucher.findFirst({
    where: { companyId },
    select: { voucherNo: true },
    orderBy: { voucherNo: 'desc' }
  });

  const lastNumber = latest?.voucherNo?.match(/^SF(\d{6})$/)?.[1];
  const nextNumber = lastNumber ? Number(lastNumber) + 1 : 1;
  return `SF${String(nextNumber).padStart(6, '0')}`;
};

const normalizeVoucherItems = (items: any[]) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('En az bir stok fişi satırı eklenmelidir');
  }

  return items.map((item, index) => {
    const quantity = Number(item.quantity);
    if (!item.productId) throw new Error(`${index + 1}. satırda ürün seçilmelidir`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`${index + 1}. satırda miktar 0'dan büyük olmalıdır`);

    return {
      productId: String(item.productId),
      lotNumber: String(item.lotNumber || '').trim(),
      quantity,
      unit: item.unit || null,
      notes: item.notes || null
    };
  });
};

// STOCK VOUCHER ROUTES
router.get('/stock-vouchers/next-number', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const voucherNo = await getNextVoucherNo(prisma as any, companyId);
    res.json({ voucherNo });
  } catch (error) {
    res.status(500).json({ error: 'Fiş numarası üretilemedi' });
  }
});

router.get('/stock-vouchers', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const takeValue = Math.min(Math.max(Number(req.query.take) || 1000, 1), 5000);
    const vouchers = await (prisma as any).stockVoucher.findMany({
      where: { companyId },
      include: voucherInclude,
      orderBy: { transactionDate: 'desc' },
      take: takeValue
    });

    res.json(vouchers);
  } catch (error) {
    console.error('Stock vouchers list error:', error);
    res.status(500).json({ error: 'Stok fişleri getirilemedi' });
  }
});

router.get('/stock-vouchers/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const id = String(req.params.id);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isPureNumber = /^\d+$/.test(id);

    // Diagnostic logging
    try {
      const log = `GET Voucher - ID: ${id}, isUUID: ${isUUID}, isPureNumber: ${isPureNumber}, companyId: ${companyId}\n`;
      fs.appendFileSync(path.join(__dirname, '../../../scratch/api_debug.log'), log);
    } catch (e) { }

    const voucher = await (prisma as any).stockVoucher.findFirst({
      where: {
        companyId,
        OR: [
          ...(isUUID ? [{ id }] : []),
          { voucherNo: { equals: id, mode: 'insensitive' } },
          ...(isPureNumber ? [{ voucherNo: `SF${id.padStart(6, '0')}` }] : [])
        ]
      },
      include: voucherInclude
    });

    if (!voucher) return res.status(404).json({ error: 'Fiş bulunamadı' });
    res.json(voucher);
  } catch (error) {
    res.status(500).json({ error: 'Fiş detayları getirilemedi' });
  }
});

router.post('/stock-vouchers/upload', authenticateToken, (req: AuthRequest, res) => {
  voucherUpload.single('file')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Belge yüklenemedi' });
    if (!req.file) return res.status(400).json({ error: 'Belge yüklenemedi' });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') as string;
    const url = `${protocol}://${host}/uploads/stock-vouchers/${req.file.filename}`;

    res.json({
      url,
      name: req.file.originalname,
      size: req.file.size
    });
  });
});

router.post('/stock-vouchers', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Company ID is missing' });

    const voucherType = String(req.body.voucherType || '');
    const typeMeta = STOCK_VOUCHER_TYPES[voucherType];
    if (!typeMeta) return res.status(400).json({ error: 'Geçersiz fiş tipi' });

    const controlStatus = String(req.body.controlStatus || 'pending');
    if (!CONTROL_STATUSES.has(controlStatus)) return res.status(400).json({ error: 'Geçersiz kontrol durumu' });

    const warehouseId = req.body.warehouseId ? String(req.body.warehouseId) : '';
    const targetWarehouseId = req.body.targetWarehouseId ? String(req.body.targetWarehouseId) : null;
    if (!warehouseId) return res.status(400).json({ error: 'Depo seçilmelidir' });
    if (voucherType === 'TRANSFER' && !targetWarehouseId) return res.status(400).json({ error: 'Transfer için hedef depo seçilmelidir' });
    if (voucherType === 'TRANSFER' && targetWarehouseId === warehouseId) return res.status(400).json({ error: 'Kaynak ve hedef depo farklı olmalıdır' });

    const items = normalizeVoucherItems(req.body.items);

    // Global Lot Uniqueness Check
    for (const item of items) {
      if (item.lotNumber) {
        const conflictingLot = await (prisma as any).stockLevel.findFirst({
          where: {
            companyId,
            lotNumber: item.lotNumber,
            productId: { not: item.productId },
            quantity: { gt: 0 }
          },
          include: { product: true }
        });
        if (conflictingLot) {
          return res.status(400).json({ error: `Lot numarası "${item.lotNumber}" zaten başka bir ürün (${conflictingLot.product.productCode}) için mevcut.` });
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const [warehouse, targetWarehouse, firm] = await Promise.all([
        tx.warehouse.findFirst({ where: { id: warehouseId, companyId }, select: { id: true } }),
        targetWarehouseId ? tx.warehouse.findFirst({ where: { id: targetWarehouseId, companyId }, select: { id: true } }) : Promise.resolve(null),
        req.body.firmId ? (tx as any).firm.findFirst({ where: { id: String(req.body.firmId), companyId }, select: { id: true } }) : Promise.resolve(null)
      ]);

      if (!warehouse) throw new Error('Seçilen depo bulunamadı');
      if (targetWarehouseId && !targetWarehouse) throw new Error('Seçilen hedef depo bulunamadı');
      if (req.body.firmId && !firm) throw new Error('Seçilen firma bulunamadı');

      const voucherNo = await getNextVoucherNo(tx as any, companyId);
      const transactionDate = new Date();

      if (controlStatus === 'accepted') {
        for (const item of items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, companyId },
            select: { id: true, unitOfMeasure: true }
          });
          if (!product) throw new Error('Fiş satırında seçilen ürün bulunamadı');

          const lotNumber = item.lotNumber || '';
          const shouldDecrease = typeMeta.direction === -1 || voucherType === 'TRANSFER';

          if (shouldDecrease) {
            const currentLevel = await tx.stockLevel.findUnique({
              where: {
                productId_warehouseId_lotNumber: {
                  productId: item.productId,
                  warehouseId,
                  lotNumber
                }
              }
            });

            if (!currentLevel || currentLevel.quantity < item.quantity) {
              throw new Error(`Yetersiz stok: ${lotNumber || 'Lotsuz'} lot için çıkış miktarı mevcut stoktan fazla`);
            }

            await tx.stockLevel.update({
              where: {
                productId_warehouseId_lotNumber: {
                  productId: item.productId,
                  warehouseId,
                  lotNumber
                }
              },
              data: { quantity: { decrement: item.quantity } }
            });
          }

          if (typeMeta.direction === 1 || voucherType === 'TRANSFER') {
            await tx.stockLevel.upsert({
              where: {
                productId_warehouseId_lotNumber: {
                  productId: item.productId,
                  warehouseId: voucherType === 'TRANSFER' ? targetWarehouseId as string : warehouseId,
                  lotNumber
                }
              },
              update: { quantity: { increment: item.quantity } },
              create: {
                companyId,
                productId: item.productId,
                warehouseId: voucherType === 'TRANSFER' ? targetWarehouseId as string : warehouseId,
                lotNumber,
                quantity: item.quantity
              }
            });
          }

          await tx.stockMovement.create({
            data: {
              companyId,
              productId: item.productId,
              fromWarehouseId: typeMeta.direction === -1 || voucherType === 'TRANSFER' ? warehouseId : null,
              toWarehouseId: typeMeta.direction === 1 ? warehouseId : voucherType === 'TRANSFER' ? targetWarehouseId : null,
              lotNumber,
              quantity: item.quantity,
              type: typeMeta.movementType,
              referenceId: voucherNo,
              description: `${typeMeta.label} stok fişi`
            }
          });
        }
      }

      const voucher = await (tx as any).stockVoucher.create({
        data: {
          companyId,
          voucherNo,
          transactionDate,
          voucherType,
          direction: typeMeta.direction,
          firmId: req.body.firmId || null,
          controlStatus,
          warehouseId,
          targetWarehouseId: voucherType === 'TRANSFER' ? targetWarehouseId : null,
          documentNo: req.body.documentNo || null,
          documentUrl: req.body.documentUrl || null,
          documentName: req.body.documentName || null,
          notes: req.body.notes || null,
          createdBy: req.user?.fullName || req.user?.email || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              lotNumber: item.lotNumber || '',
              quantity: item.quantity,
              unit: item.unit || null,
              notes: item.notes || null
            }))
          }
        },
        include: voucherInclude
      });

      return voucher;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Stock voucher create error:', error);
    res.status(400).json({ error: error.message || 'Stok fişi işlenemedi' });
  }
});

router.put('/stock-vouchers/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    const { voucherNo, firmId, controlStatus, documentNo, documentUrl, documentName, notes, items: newItems } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const isPureNumber = /^\d+$/.test(id);

      // Diagnostic logging
      try {
        const log = `PUT Voucher - ID: ${id}, isUUID: ${isUUID}, isPureNumber: ${isPureNumber}, companyId: ${companyId}\n`;
        fs.appendFileSync(path.join(__dirname, '../../../scratch/api_debug.log'), log);
      } catch (e) { }

      // 1. Get old voucher with items to reverse
      const oldVoucher = await (tx as any).stockVoucher.findFirst({
        where: {
          companyId,
          OR: [
            ...(isUUID ? [{ id }] : []),
            { voucherNo: { equals: id, mode: 'insensitive' } },
            ...(isPureNumber ? [{ voucherNo: `SF${id.padStart(6, '0')}` }] : [])
          ]
        },
        include: { items: true }
      });

      if (!oldVoucher) throw new Error('Fiş bulunamadı');

      const finalVoucherNo = voucherNo || oldVoucher.voucherNo;
      const typeMeta = STOCK_VOUCHER_TYPES[oldVoucher.voucherType];
      const newControlStatus = controlStatus || oldVoucher.controlStatus;

      // 2. Handle items and stock changes
      if (newItems && Array.isArray(newItems)) {
        const normalizedItems = normalizeVoucherItems(newItems);

        // A. Global Lot Uniqueness Check
        for (const item of normalizedItems) {
          if (item.lotNumber) {
            const conflictingLot = await tx.stockLevel.findFirst({
              where: {
                companyId,
                lotNumber: item.lotNumber,
                productId: { not: item.productId },
                quantity: { gt: 0 }
              },
              include: { product: true }
            });
            if (conflictingLot) {
              throw new Error(`Lot numarası "${item.lotNumber}" zaten başka bir ürün (${conflictingLot.product.productCode}) için mevcut.`);
            }
          }
        }

        // B. Reverse old stock changes (Only if it was previously accepted)
        if (oldVoucher.controlStatus === 'accepted') {
          for (const item of oldVoucher.items) {
            const direction = oldVoucher.direction;
            const warehouseId = oldVoucher.warehouseId;
            const targetWarehouseId = oldVoucher.targetWarehouseId;

            if (oldVoucher.voucherType === 'TRANSFER') {
              await tx.stockLevel.update({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId, lotNumber: item.lotNumber } },
                data: { quantity: { increment: item.quantity } }
              });
              await tx.stockLevel.update({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId: targetWarehouseId as string, lotNumber: item.lotNumber } },
                data: { quantity: { decrement: item.quantity } }
              });
            } else {
              await tx.stockLevel.update({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId, lotNumber: item.lotNumber } },
                data: { quantity: { [direction === 1 ? 'decrement' : 'increment']: item.quantity } }
              });
            }
          }
          // Delete old movements
          await tx.stockMovement.deleteMany({ where: { referenceId: oldVoucher.voucherNo, companyId } });
        }

        // D. Delete old items
        await (tx as any).stockVoucherItem.deleteMany({ where: { voucherId: oldVoucher.id } });

        // E. Apply new items and movements (Only if new status is accepted)
        if (newControlStatus === 'accepted') {
          for (const item of normalizedItems) {
            const lotNumber = item.lotNumber || '';
            const shouldDecrease = typeMeta.direction === -1 || oldVoucher.voucherType === 'TRANSFER';

            if (shouldDecrease) {
              const currentLevel = await tx.stockLevel.findUnique({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId: oldVoucher.warehouseId, lotNumber } }
              });
              if (!currentLevel || currentLevel.quantity < item.quantity) {
                throw new Error(`Yetersiz stok: ${lotNumber || 'Lotsuz'} lot için çıkış miktarı mevcut stoktan fazla`);
              }
              await tx.stockLevel.update({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId: oldVoucher.warehouseId, lotNumber } },
                data: { quantity: { decrement: item.quantity } }
              });
            }

            if (typeMeta.direction === 1 || oldVoucher.voucherType === 'TRANSFER') {
              await tx.stockLevel.upsert({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId: oldVoucher.voucherType === 'TRANSFER' ? oldVoucher.targetWarehouseId as string : oldVoucher.warehouseId, lotNumber } },
                update: { quantity: { increment: item.quantity } },
                create: { companyId, productId: item.productId, warehouseId: oldVoucher.voucherType === 'TRANSFER' ? oldVoucher.targetWarehouseId as string : oldVoucher.warehouseId, lotNumber, quantity: item.quantity }
              });
            }

            await tx.stockMovement.create({
              data: {
                companyId,
                productId: item.productId,
                fromWarehouseId: shouldDecrease ? oldVoucher.warehouseId : null,
                toWarehouseId: typeMeta.direction === 1 ? oldVoucher.warehouseId : oldVoucher.voucherType === 'TRANSFER' ? oldVoucher.targetWarehouseId : null,
                lotNumber,
                quantity: item.quantity,
                type: typeMeta.movementType,
                referenceId: finalVoucherNo,
                description: `${typeMeta.label} stok fişi (Güncellendi)`
              }
            });
          }
        }

        // F. Create new voucher items
        await (tx as any).stockVoucherItem.createMany({
          data: normalizedItems.map(item => ({
            voucherId: oldVoucher.id,
            productId: item.productId,
            lotNumber: item.lotNumber || '',
            quantity: item.quantity,
            unit: item.unit || null,
            notes: item.notes || null
          }))
        });
      } else if (controlStatus && controlStatus !== oldVoucher.controlStatus) {
        // If items haven't changed but status HAS changed
        if (oldVoucher.controlStatus === 'accepted' && newControlStatus !== 'accepted') {
          // Reverse stock
          for (const item of oldVoucher.items) {
            const direction = oldVoucher.direction;
            const warehouseId = oldVoucher.warehouseId;
            const targetWarehouseId = oldVoucher.targetWarehouseId;

            if (oldVoucher.voucherType === 'TRANSFER') {
              await tx.stockLevel.update({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId, lotNumber: item.lotNumber } },
                data: { quantity: { increment: item.quantity } }
              });
              await tx.stockLevel.update({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId: targetWarehouseId as string, lotNumber: item.lotNumber } },
                data: { quantity: { decrement: item.quantity } }
              });
            } else {
              await tx.stockLevel.update({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId, lotNumber: item.lotNumber } },
                data: { quantity: { [direction === 1 ? 'decrement' : 'increment']: item.quantity } }
              });
            }
          }
          await tx.stockMovement.deleteMany({ where: { referenceId: oldVoucher.voucherNo, companyId } });
        } else if (oldVoucher.controlStatus !== 'accepted' && newControlStatus === 'accepted') {
          // Apply stock
          for (const item of oldVoucher.items) {
            const lotNumber = item.lotNumber || '';
            const shouldDecrease = typeMeta.direction === -1 || oldVoucher.voucherType === 'TRANSFER';

            if (shouldDecrease) {
              const currentLevel = await tx.stockLevel.findUnique({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId: oldVoucher.warehouseId, lotNumber } }
              });
              if (!currentLevel || currentLevel.quantity < item.quantity) {
                throw new Error(`Yetersiz stok: ${lotNumber || 'Lotsuz'} lot için çıkış miktarı mevcut stoktan fazla`);
              }
              await tx.stockLevel.update({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId: oldVoucher.warehouseId, lotNumber } },
                data: { quantity: { decrement: item.quantity } }
              });
            }

            if (typeMeta.direction === 1 || oldVoucher.voucherType === 'TRANSFER') {
              await tx.stockLevel.upsert({
                where: { productId_warehouseId_lotNumber: { productId: item.productId, warehouseId: oldVoucher.voucherType === 'TRANSFER' ? oldVoucher.targetWarehouseId as string : oldVoucher.warehouseId, lotNumber } },
                update: { quantity: { increment: item.quantity } },
                create: { companyId, productId: item.productId, warehouseId: oldVoucher.voucherType === 'TRANSFER' ? oldVoucher.targetWarehouseId as string : oldVoucher.warehouseId, lotNumber, quantity: item.quantity }
              });
            }

            await tx.stockMovement.create({
              data: {
                companyId,
                productId: item.productId,
                fromWarehouseId: shouldDecrease ? oldVoucher.warehouseId : null,
                toWarehouseId: typeMeta.direction === 1 ? oldVoucher.warehouseId : oldVoucher.voucherType === 'TRANSFER' ? oldVoucher.targetWarehouseId : null,
                lotNumber,
                quantity: item.quantity,
                type: typeMeta.movementType,
                referenceId: finalVoucherNo,
                description: `${typeMeta.label} stok fişi (Onaylandı)`
              }
            });
          }
        }
      } else if (voucherNo && voucherNo !== oldVoucher.voucherNo) {
        // If ONLY voucherNo changed and status is accepted, update referenceId in movements
        if (oldVoucher.controlStatus === 'accepted') {
          await tx.stockMovement.updateMany({
            where: { referenceId: oldVoucher.voucherNo, companyId },
            data: { referenceId: voucherNo }
          });
        }
      }

      // 3. Update voucher header
      return await (tx as any).stockVoucher.update({
        where: { id: oldVoucher.id, companyId },
        data: {
          voucherNo: voucherNo || undefined,
          firmId: firmId || null,
          controlStatus: controlStatus || undefined,
          documentNo: documentNo || null,
          documentUrl: documentUrl || null,
          documentName: documentName || null,
          notes: notes || null
        },
        include: voucherInclude
      });
    });

    res.json(result);
  } catch (error: any) {
    console.error('Stock voucher update error:', error);
    res.status(400).json({
      error: error.message || 'Fiş güncellenemedi',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.delete('/stock-vouchers/:id', authenticateToken, async (req: AuthRequest, res) => {
  const companyId = getCompanyId(req);
  const id = String(req.params.id);
  try {


    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isPureNumber = /^\d+$/.test(id);

    const voucher = await (prisma as any).stockVoucher.findFirst({
      where: {
        companyId,
        OR: [
          ...(isUUID ? [{ id }] : []),
          { voucherNo: { equals: id, mode: 'insensitive' } },
          ...(isPureNumber ? [{ voucherNo: `SF${id.padStart(6, '0')}` }] : [])
        ]
      },
      include: { items: true }
    });

    if (!voucher) return res.status(404).json({ error: 'Fiş bulunamadı' });

    await prisma.$transaction(async (tx) => {
      // Reverse stock levels (Only if it was accepted)
      if (voucher.controlStatus === 'accepted') {
        for (const item of voucher.items) {
          const direction = voucher.direction; // 1 for entry, -1 for exit
          const warehouseId = voucher.warehouseId;
          const targetWarehouseId = voucher.targetWarehouseId;
          const lotNumber = item.lotNumber || '';

          if (voucher.voucherType === 'TRANSFER') {
            // 1. Revert Source: Increase source warehouse stock
            const sourceLevel = await tx.stockLevel.findFirst({
              where: { productId: item.productId, warehouseId, lotNumber }
            });

            if (sourceLevel) {
              await tx.stockLevel.updateMany({
                where: { id: sourceLevel.id },
                data: { quantity: { increment: item.quantity } }
              });
            } else {
              await tx.stockLevel.create({
                data: { companyId, productId: item.productId, warehouseId, lotNumber, quantity: item.quantity }
              });
            }

            // 2. Revert Target: Decrease target warehouse stock
            if (targetWarehouseId) {
              const targetLevel = await tx.stockLevel.findFirst({
                where: { productId: item.productId, warehouseId: targetWarehouseId, lotNumber }
              });
              if (targetLevel) {
                await tx.stockLevel.updateMany({
                  where: { id: targetLevel.id },
                  data: { quantity: { decrement: Math.min(item.quantity, targetLevel.quantity) } }
                });
              }
            }
          } else {
            // Entry: decrement, Exit: increment
            const currentLevel = await tx.stockLevel.findFirst({
              where: { productId: item.productId, warehouseId, lotNumber }
            });

            if (direction === 1) { // Entry reversal = decrement
              if (currentLevel) {
                await tx.stockLevel.updateMany({
                  where: { id: currentLevel.id },
                  data: { quantity: { decrement: Math.min(item.quantity, currentLevel.quantity) } }
                });
              }
            } else { // Exit reversal = increment
              if (currentLevel) {
                await tx.stockLevel.updateMany({
                  where: { id: currentLevel.id },
                  data: { quantity: { increment: item.quantity } }
                });
              } else {
                await tx.stockLevel.create({
                  data: { companyId, productId: item.productId, warehouseId, lotNumber, quantity: item.quantity }
                });
              }
            }
          }
        }

        // Delete movements associated with this voucher (referenceId = voucherNo)
        await tx.stockMovement.deleteMany({
          where: { referenceId: voucher.voucherNo, companyId }
        });
      }

      // Delete voucher items
      await (tx as any).stockVoucherItem.deleteMany({
        where: { voucherId: voucher.id }
      });

      // Delete voucher
      await (tx as any).stockVoucher.deleteMany({
        where: { id: voucher.id }
      });
    });

    res.json({ success: true, message: 'Fiş ve bağlı hareketler silindi' });
  } catch (error: any) {
    console.error('CRITICAL DELETE ERROR:', error);
    
    // Minimal error data to avoid circular refs
    const errorData = {
      message: String(error.message || error),
      code: error.code,
      meta: error.meta,
      voucherId: id,
      companyId: companyId
    };

    res.status(400).json({ 
      error: errorData.message,
      details: errorData,
      stack: process.env.NODE_ENV === 'development' ? String(error.stack) : undefined
    });
  }
});

// WAREHOUSE ROUTES
router.get('/warehouses', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Şirket ID eksik' });

    const warehouses = await prisma.warehouse.findMany({
      where: { companyId },
      include: {
        _count: { select: { stockLevels: true } }
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
    });
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ error: 'Depolar getirilemedi' });
  }
});

router.post('/warehouses', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Şirket ID eksik' });

    const { name, code, type, status, unitId, locationId } = req.body;

    const lastItem = await prisma.warehouse.findFirst({
      where: { companyId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });
    const nextOrder = (lastItem?.displayOrder ?? -1) + 1;

    const warehouse = await (prisma as any).warehouse.create({
      data: {
        companyId,
        name,
        code: code || null,
        type: type || 'general',
        status: status || 'active',
        unitId: unitId || null,
        locationId: locationId || null,
        displayOrder: nextOrder
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
    if (!companyId) return res.status(400).json({ error: 'Şirket ID eksik' });

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
    if (!companyId) return res.status(400).json({ error: 'Şirket ID eksik' });

    const levels = await prisma.stockLevel.findMany({
      where: { companyId },
      include: {
        product: { select: { id: true, productCode: true, productName: true, productGroup: true, unitOfMeasure: true } },
        warehouse: { select: { id: true, name: true, code: true, type: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(levels);
  } catch (error) {
    res.status(500).json({ error: 'Stok seviyeleri getirilemedi' });
  }
});

router.get('/levels/export', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Şirket ID eksik' });

    const { warehouseId, search, product, lotNumber, stockStatus } = req.query;
    const where: any = { companyId };
    const andFilters: any[] = [];

    if (warehouseId && warehouseId !== 'all') {
      where.warehouseId = warehouseId as string;
    }

    if (search) {
      andFilters.push({
        OR: [
          { product: { is: { productCode: { contains: String(search), mode: 'insensitive' } } } },
          { product: { is: { productName: { contains: String(search), mode: 'insensitive' } } } },
          { lotNumber: { contains: String(search), mode: 'insensitive' } },
          { warehouse: { is: { name: { contains: String(search), mode: 'insensitive' } } } }
        ]
      });
    }

    if (product) {
      andFilters.push({
        OR: [
          { product: { is: { productCode: { contains: String(product), mode: 'insensitive' } } } },
          { product: { is: { productName: { contains: String(product), mode: 'insensitive' } } } }
        ]
      });
    }

    if (lotNumber) {
      where.lotNumber = { contains: String(lotNumber), mode: 'insensitive' };
    }

    if (stockStatus === 'positive') where.quantity = { gt: 0 };
    if (stockStatus === 'zero') where.quantity = 0;
    if (stockStatus === 'negative') where.quantity = { lt: 0 };

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const levels = await prisma.stockLevel.findMany({
      where,
      include: {
        product: { select: { productCode: true, productName: true, productGroup: true, unitOfMeasure: true, category: true, trackingType: true } },
        warehouse: { select: { name: true, code: true, type: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const workbook = new exceljs.Workbook();
    workbook.creator = 'Sosturer';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Detaylı Envanter');

    sheet.columns = [
      { header: 'Ürün Kodu', key: 'productCode', width: 18 },
      { header: 'Ürün Adı', key: 'productName', width: 48 },
      { header: 'Ürün Grubu', key: 'productGroup', width: 20 },
      { header: 'Kategori', key: 'category', width: 18 },
      { header: 'Takip Tipi', key: 'trackingType', width: 16 },
      { header: 'Depo Kodu', key: 'warehouseCode', width: 16 },
      { header: 'Depo Adı', key: 'warehouseName', width: 24 },
      { header: 'Depo Tipi', key: 'warehouseType', width: 16 },
      { header: 'Lot Numarası', key: 'lotNumber', width: 22 },
      { header: 'Miktar', key: 'quantity', width: 14 },
      { header: 'Birim', key: 'unitOfMeasure', width: 12 },
      { header: 'Son Güncelleme', key: 'updatedAt', width: 22 }
    ];

    levels.forEach((level) => {
      sheet.addRow({
        productCode: level.product.productCode,
        productName: level.product.productName,
        productGroup: level.product.productGroup || '',
        category: level.product.category || '',
        trackingType: level.product.trackingType || '',
        warehouseCode: level.warehouse.code || '',
        warehouseName: level.warehouse.name,
        warehouseType: level.warehouse.type,
        lotNumber: level.lotNumber || '',
        quantity: level.quantity,
        unitOfMeasure: level.product.unitOfMeasure || '',
        updatedAt: level.updatedAt
      });
    });

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: 'L1' };
    sheet.getColumn('quantity').numFmt = '#,##0.00';
    sheet.getColumn('updatedAt').numFmt = 'dd.mm.yyyy hh:mm';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=detayli_envanter_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Inventory Excel export error:', error);
    res.status(500).json({ error: 'Envanter Excel çıktısı oluşturulamadı' });
  }
});

// STOCK MOVEMENT ROUTES
router.get('/movements', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Şirket ID eksik' });

    const {
      search,
      productId,
      product,
      lotNumber,
      type,
      warehouseId,
      startDate,
      endDate,
      referenceId,
      take
    } = req.query;

    const where: any = { companyId };
    const andFilters: any[] = [];

    if (productId) where.productId = productId as string;
    if (type && type !== 'all') where.type = type as string;
    if (lotNumber) where.lotNumber = { contains: String(lotNumber), mode: 'insensitive' };
    if (referenceId) where.referenceId = { contains: String(referenceId), mode: 'insensitive' };

    if (warehouseId && warehouseId !== 'all') {
      andFilters.push({
        OR: [
          { fromWarehouseId: warehouseId as string },
          { toWarehouseId: warehouseId as string }
        ]
      });
    }

    if (product) {
      andFilters.push({
        OR: [
          { product: { is: { productCode: { contains: String(product), mode: 'insensitive' } } } },
          { product: { is: { productName: { contains: String(product), mode: 'insensitive' } } } }
        ]
      });
    }

    if (search) {
      andFilters.push({
        OR: [
          { product: { is: { productCode: { contains: String(search), mode: 'insensitive' } } } },
          { product: { is: { productName: { contains: String(search), mode: 'insensitive' } } } },
          { lotNumber: { contains: String(search), mode: 'insensitive' } },
          { referenceId: { contains: String(search), mode: 'insensitive' } },
          { description: { contains: String(search), mode: 'insensitive' } },
          { fromWarehouse: { is: { name: { contains: String(search), mode: 'insensitive' } } } },
          { toWarehouse: { is: { name: { contains: String(search), mode: 'insensitive' } } } }
        ]
      });
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setDate(end.getDate() + 1);
        where.createdAt.lt = end;
      }
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const takeValue = Math.min(Math.max(Number(take) || 1000, 1), 5000);

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, productCode: true, productName: true, unitOfMeasure: true } },
        fromWarehouse: { select: { id: true, name: true, code: true, type: true } },
        toWarehouse: { select: { id: true, name: true, code: true, type: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: takeValue
    });
    res.json(movements);
  } catch (error) {
    console.error('Stock movements filter error:', error);
    res.status(500).json({ error: 'Stok hareketleri getirilemedi' });
  }
});

router.post('/movements', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'Şirket ID eksik' });

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
