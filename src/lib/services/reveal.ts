import { prisma } from '@/lib/db';
import { computeLeaderboard, countedJudges, ScoreLite, TeamLite } from '@/lib/scoring';
import { broadcast } from '@/lib/events';

type State = 'drafting' | 'provisional' | 'final';

async function settings() {
  return prisma.settings.upsert({ where:{ id:1 }, update:{}, create:{ id:1, revealState:'drafting' } });
}
export async function getRevealState(): Promise<State> { return (await settings()).revealState as State; }
export async function getHeroImage(): Promise<string | null> { return (await settings()).heroImageUrl ?? null; }
export async function setHeroImage(url: string | null) {
  await prisma.settings.upsert({ where:{ id:1 }, update:{ heroImageUrl: url }, create:{ id:1, heroImageUrl: url } });
  broadcast('reveal', { hero: true });
}
export async function getBannerImage(): Promise<string | null> { return (await settings()).bannerImageUrl ?? null; }
export async function setBannerImage(url: string | null) {
  await prisma.settings.upsert({ where:{ id:1 }, update:{ bannerImageUrl: url }, create:{ id:1, bannerImageUrl: url } });
  broadcast('reveal', { banner: true });
}
export async function setRevealState(state: State, actorId?: string) {
  await prisma.settings.upsert({ where:{ id:1 }, update:{ revealState: state }, create:{ id:1, revealState: state } });
  await prisma.auditLog.create({ data:{ actorId, action:'reveal:'+state } });
  broadcast('reveal', { state });
}
export async function getResults() {
  const state = await getRevealState();
  const [teams, scoreRows, judges, criteria] = await Promise.all([
    prisma.team.findMany({
      orderBy:{ createdAt:'asc' },
      include:{ members:{ select:{ id:true, name:true, photoUrl:true, teamRole:true } } },
    }),
    prisma.score.findMany({ select:{ judgeId:true, teamId:true, criterionId:true, value:true } }),
    prisma.user.findMany({ where:{ role:'judge' }, select:{ id:true, isHead:true, active:true } }),
    prisma.criterion.findMany({ select:{ maxScore:true } }),
  ]);
  // Head is looked up across ALL judges, not just active ones: a deactivated
  // head must still have their card held back until the final reveal.
  const head = judges.find((j) => j.isHead) ?? null;
  const phase = state === 'final' ? 'final' : 'provisional';
  const teamsLite: TeamLite[] = teams.map(t => ({ id:t.id, name:t.name, code:t.code, logoUrl:t.logoUrl, tag:t.tag }));
  const scores: ScoreLite[] = scoreRows;
  const rows = computeLeaderboard({ teams: teamsLite, scores, headJudgeId: head?.id ?? null, phase });
  const membersByTeam = Object.fromEntries(teams.map(t => [t.id, t.members]));
  const enriched = rows.map(r => ({ ...r, team: { ...r.team, members: membersByTeam[r.team.id] ?? [] } }));
  const baremTotal = Math.round(criteria.reduce((a,c)=>a+c.maxScore,0)*10)/10;
  // Team scores are sums, so the denominator is one judge's barem times the
  // number of judges this phase counts — not the number who happen to have
  // scored a given team. Every team shares it, so the bars stay comparable.
  const judgeCount = countedJudges(judges.filter((j) => j.active), phase);
  const maxTotal = Math.round(baremTotal * judgeCount * 10) / 10;
  const settingsRow = await settings();
  return {
    state, rows: enriched, baremTotal, maxTotal, judgeCount,
    heroImageUrl: settingsRow.heroImageUrl ?? null,
    bannerImageUrl: settingsRow.bannerImageUrl ?? null,
  };
}
