import { prisma } from '@/lib/db';
import { computeLeaderboard, ScoreLite, TeamLite } from '@/lib/scoring';
import { broadcast } from '@/lib/events';

type State = 'drafting' | 'provisional' | 'final';

async function settings() {
  return prisma.settings.upsert({ where:{ id:1 }, update:{}, create:{ id:1, revealState:'drafting' } });
}
export async function getRevealState(): Promise<State> { return (await settings()).revealState as State; }
export async function setRevealState(state: State, actorId?: string) {
  await prisma.settings.upsert({ where:{ id:1 }, update:{ revealState: state }, create:{ id:1, revealState: state } });
  await prisma.auditLog.create({ data:{ actorId, action:'reveal:'+state } });
  broadcast('reveal', { state });
}
export async function getResults() {
  const state = await getRevealState();
  const [teams, scoreRows, head, criteria] = await Promise.all([
    prisma.team.findMany({
      orderBy:{ createdAt:'asc' },
      include:{ members:{ select:{ id:true, name:true, photoUrl:true, teamRole:true } } },
    }),
    prisma.score.findMany({ select:{ judgeId:true, teamId:true, criterionId:true, value:true } }),
    prisma.user.findFirst({ where:{ role:'judge', isHead:true }, select:{ id:true } }),
    prisma.criterion.findMany({ select:{ maxScore:true } }),
  ]);
  const phase = state === 'final' ? 'final' : 'provisional';
  const teamsLite: TeamLite[] = teams.map(t => ({ id:t.id, name:t.name, code:t.code, logoUrl:t.logoUrl, tag:t.tag }));
  const scores: ScoreLite[] = scoreRows;
  const rows = computeLeaderboard({ teams: teamsLite, scores, headJudgeId: head?.id ?? null, phase });
  const membersByTeam = Object.fromEntries(teams.map(t => [t.id, t.members]));
  const enriched = rows.map(r => ({ ...r, team: { ...r.team, members: membersByTeam[r.team.id] ?? [] } }));
  const baremTotal = Math.round(criteria.reduce((a,c)=>a+c.maxScore,0)*10)/10;
  return { state, rows: enriched, baremTotal };
}
