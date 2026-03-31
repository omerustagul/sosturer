
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const productId = 'SLV 16000'; // Actually it's probably the UUID. I'll search by product code.
  const product = await prisma.product.findFirst({ where: { productCode: 'SLV 16000' } });
  if (!product) {
    console.log('Product not found with code SLV 16000');
    return;
  }
  const records = await prisma.productionRecord.findMany({
    where: { productId: product.id },
    select: { cycleTimeSeconds: true, id: true }
  });
  console.log('Product:', product.productName, '(', product.id, ')');
  console.log('Record Count:', records.length);
  const sum = records.reduce((acc, r) => acc + (r.cycleTimeSeconds || 0), 0);
  const avg = sum / (records.length || 1);
  console.log('Average:', avg);
  console.log('Sample Data (top 10):', records.slice(0, 10));
  
  // Highlight any huge ones
  const outliers = records.filter(r => r.cycleTimeSeconds > 500);
  console.log('Outliers (> 500s):', outliers.length, outliers.slice(0, 5));
  
  process.exit(0);
}

check();
