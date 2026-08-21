import { prisma } from '@/lib/db';
import { uniqueCode, regenerateUserCode } from '@/lib/services/access';

export function listJudges() {
  return prisma.user.findMany({ where:{ role:'judge' }, orderBy:{ createdAt:'asc' } });
}
export async function createJudge(data:{ name:string }) {
  return prisma.user.create({ data:{ name:data.name, role:'judge', accessCode: await uniqueCode() } });
}
export async function regenerateCode(id:string) { return regenerateUserCode(id); }
export function updateJudge(id:string, data:{ name?:string }) { return prisma.user.update({ where:{ id }, data }); }
export async function deleteJudge(id:string) { await prisma.user.delete({ where:{ id } }); }
