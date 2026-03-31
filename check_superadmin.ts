import prisma from './server/src/lib/prisma';

async function main() {
  const superadmins = await prisma.user.findMany({ where: { role: 'superadmin' } });
  console.log('Superadmins:', superadmins.map(u => ({ email: u.email, fullName: u.fullName })));
}
main().catch(console.error);
