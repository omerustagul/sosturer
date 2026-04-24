import prisma from '../lib/prisma';

export async function adjustStockFromProduction(params: {
  companyId: string;
  productId: string;
  quantity: number;
  type: 'ADD' | 'REMOVE';
  referenceId: string;
}) {
  const { companyId, productId, quantity, type, referenceId } = params;

  // Find a production warehouse for this company
  let warehouse = await prisma.warehouse.findFirst({
    where: { companyId, type: 'PRODUCTION' }
  });

  // If none exists, find any warehouse (default to first)
  if (!warehouse) {
    warehouse = await prisma.warehouse.findFirst({
      where: { companyId }
    });
  }

  // If still none, create a default one
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        companyId,
        name: 'Ana Depo',
        type: 'PRODUCTION'
      }
    });
  }

  const warehouseId = warehouse.id;

  return await prisma.$transaction(async (tx) => {
    // 1. Find or create stock level for this product/warehouse
    const currentLevel = await tx.stockLevel.findUnique({
      where: {
        productId_warehouseId_lotNumber: { productId, warehouseId, lotNumber: "" }
      }
    });

    const finalQuantity = type === 'ADD' ? quantity : -quantity;

    if (currentLevel) {
      await tx.stockLevel.update({
        where: { id: currentLevel.id },
        data: { quantity: { increment: finalQuantity } }
      });
    } else {
      await tx.stockLevel.create({
        data: {
          companyId,
          productId,
          warehouseId,
          quantity: Math.max(0, finalQuantity)
        }
      });
    }

    // 2. Log movement
    await tx.stockMovement.create({
      data: {
        companyId,
        productId,
        quantity: Math.abs(finalQuantity),
        type: type === 'ADD' ? 'PRODUCTION' : 'INTERNAL', // simplified
        toWarehouseId: type === 'ADD' ? warehouseId : undefined,
        fromWarehouseId: type === 'REMOVE' ? warehouseId : undefined,
        referenceId
      }
    });
  });
}
