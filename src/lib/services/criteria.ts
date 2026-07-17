import { prisma } from '@/lib/db';
export function listCriteria() { return prisma.criterion.findMany({ orderBy:{ order:'asc' } }); }
export async function createCriterion(data:{ name:string; maxScore:number; description?:string }) {
  const count = await prisma.criterion.count();
  return prisma.criterion.create({ data:{ ...data, order: count } });
}
export function updateCriterion(id:string, data:{ name?:string; maxScore?:number; description?:string; order?:number }) {
  return prisma.criterion.update({ where:{ id }, data });
}
export async function deleteCriterion(id:string) { await prisma.criterion.delete({ where:{ id } }); }
export function baremTotal(criteria:{ maxScore:number }[]) { return Math.round(criteria.reduce((a,c)=>a+c.maxScore,0)*10)/10; }
