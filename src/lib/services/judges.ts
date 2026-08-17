import { prisma } from '@/lib/db';
import { uniqueCode, regenerateUserCode } from '@/lib/services/access';

export function listJudges() {
  return prisma.user.findMany({ where:{ role:'judge' }, orderBy:{ createdAt:'asc' } });
}
export async function createJudge(data:{ name:string; isHead?:boolean }) {
  if (data.isHead) await prisma.user.updateMany({ where:{ role:'judge', isHead:true }, data:{ isHead:false } });
  return prisma.user.create({ data:{ name:data.name, role:'judge', isHead:!!data.isHead, accessCode: await uniqueCode() } });
}
export async function regenerateCode(id:string) { return regenerateUserCode(id); }
export function updateJudge(id:string, data:{ name?:string }) { return prisma.user.update({ where:{ id }, data }); }
export async function setHead(id:string) {
  await prisma.user.updateMany({ where:{ role:'judge', isHead:true }, data:{ isHead:false } });
  await prisma.user.update({ where:{ id }, data:{ isHead:true } });
}
export async function deleteJudge(id:string) { await prisma.user.delete({ where:{ id } }); }
