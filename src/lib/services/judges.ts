import { prisma } from '@/lib/db';
import { generateAccessCode } from '@/lib/access-code';

async function uniqueCode(): Promise<string> {
  for (let i=0;i<10;i++){ const c=generateAccessCode(); if(!(await prisma.user.findUnique({where:{accessCode:c}}))) return c; }
  return generateAccessCode()+Math.floor(Math.random()*9);
}
export function listJudges() { return prisma.user.findMany({ where:{ role:'judge' }, orderBy:{ createdAt:'asc' } }); }
export async function createJudge(data:{ name:string; isHead?:boolean }) {
  if (data.isHead) await prisma.user.updateMany({ where:{ role:'judge', isHead:true }, data:{ isHead:false } });
  return prisma.user.create({ data:{ name:data.name, role:'judge', isHead:!!data.isHead, accessCode: await uniqueCode() } });
}
export async function regenerateCode(id:string) { return prisma.user.update({ where:{ id }, data:{ accessCode: await uniqueCode() } }); }
export async function setHead(id:string) {
  await prisma.user.updateMany({ where:{ role:'judge', isHead:true }, data:{ isHead:false } });
  await prisma.user.update({ where:{ id }, data:{ isHead:true } });
}
export async function deleteJudge(id:string) { await prisma.user.delete({ where:{ id } }); }
