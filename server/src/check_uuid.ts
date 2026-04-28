import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const id = '76c8ac30-aa9d-4e87-916d-6b2cb585bb30';
  const voucher = await prisma.stockVoucher.findUnique({
    where: { id }
  });
  console.log('Voucher:', JSON.stringify(voucher, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
