import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { isHead: 'desc' }, { createdAt: 'asc' }] });
  console.log('\n  MÃ TRUY CẬP HIỆN TẠI\n  ' + '-'.repeat(46));
  for (const u of users) {
    const role = u.role === 'admin' ? 'ADMIN' : (u.isHead ? 'BGK · Trưởng' : 'BGK');
    console.log(`  ${role.padEnd(14)} ${u.name.padEnd(20)} ${u.accessCode}`);
  }
  console.log('');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
