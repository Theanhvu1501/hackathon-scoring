import { prisma } from '@/lib/db';

export type MemberInput = { name:string; teamRole?:string; photoUrl?:string; org?:string; email?:string; phone?:string; intro?:string };

export function listTeams() {
  return prisma.team.findMany({ orderBy:{ createdAt:'asc' }, include:{ members:true } });
}
export function createTeam(data:{ name:string; code:string; logoUrl?:string; tag?:string }) {
  return prisma.team.create({ data });
}
export function updateTeam(id:string, data:{ name?:string; code?:string; logoUrl?:string; tag?:string }) {
  return prisma.team.update({ where:{ id }, data });
}
export async function deleteTeam(id:string) { await prisma.team.delete({ where:{ id } }); }
export function addMember(teamId:string, data:MemberInput) { return prisma.member.create({ data:{ ...data, teamId } }); }
export function updateMember(id:string, data:Partial<MemberInput>) { return prisma.member.update({ where:{ id }, data }); }
export async function deleteMember(id:string) { await prisma.member.delete({ where:{ id } }); }
