import { describe, it, expect } from 'vitest';
import { judgeTotal, teamAverage, computeLeaderboard, ScoreLite, TeamLite } from '@/lib/scoring';

const teams: TeamLite[] = [
  { id: 't1', name: 'EV Nexus', code: 'EV' },
  { id: 't2', name: 'CarVision', code: 'CV' },
  { id: 't3', name: 'RoadMind', code: 'RM' },
];
// judges: j1..j4 normal, jH head
function s(judgeId:string, teamId:string, criterionId:string, value:number): ScoreLite {
  return { judgeId, teamId, criterionId, value };
}
// two criteria c1(max25) c2(max25)
const scores: ScoreLite[] = [
  // t1: j1..j4 give totals 46, jH gives 50
  s('j1','t1','c1',23), s('j1','t1','c2',23),
  s('j2','t1','c1',22), s('j2','t1','c2',24),
  s('j3','t1','c1',23), s('j3','t1','c2',23),
  s('j4','t1','c1',24), s('j4','t1','c2',22),
  s('jH','t1','c1',25), s('jH','t1','c2',25),
  // t2: j1..j4 totals 48,48,47,47 -> avg 47.5; jH gives 40 (drops it), final avg 46.0
  s('j1','t2','c1',24), s('j1','t2','c2',24),
  s('j2','t2','c1',24), s('j2','t2','c2',24),
  s('j3','t2','c1',24), s('j3','t2','c2',23),
  s('j4','t2','c1',24), s('j4','t2','c2',23),
  s('jH','t2','c1',20), s('jH','t2','c2',20),
  // t3: only j1 scored (partial)
  s('j1','t3','c1',20), s('j1','t3','c2',20),
];

describe('judgeTotal', () => {
  it('sums a judge criterion scores for a team', () => {
    expect(judgeTotal(scores, 't1', 'j1')).toBe(46);
  });
  it('returns null when judge has no scores for team', () => {
    expect(judgeTotal(scores, 't3', 'j2')).toBeNull();
  });
});

describe('teamAverage', () => {
  it('averages all judges including head', () => {
    // t1: (46+46+46+46+50)/5 = 46.8
    expect(teamAverage(scores, 't1').avg).toBeCloseTo(46.8, 5);
    expect(teamAverage(scores, 't1').judgeCount).toBe(5);
  });
  it('excludes head judge when asked', () => {
    // t1 without jH: (46+46+46+46)/4 = 46
    const r = teamAverage(scores, 't1', { excludeJudgeId: 'jH' });
    expect(r.avg).toBeCloseTo(46, 5);
    expect(r.judgeCount).toBe(4);
  });
  it('returns null avg for team with no scores', () => {
    expect(teamAverage(scores, 'tX').avg).toBeNull();
  });
});

describe('computeLeaderboard', () => {
  it('provisional excludes head judge', () => {
    const rows = computeLeaderboard({ teams, scores, headJudgeId: 'jH', phase: 'provisional' });
    const byId = Object.fromEntries(rows.map(r => [r.team.id, r]));
    expect(byId['t2'].score).toBeCloseTo(47.5, 5); // t2 leads provisionally
    expect(byId['t1'].score).toBeCloseTo(46, 5);
    expect(rows[0].team.id).toBe('t2');
    expect(rows[0].rank).toBe(1);
  });
  it('final includes head judge and reshuffles', () => {
    const rows = computeLeaderboard({ teams, scores, headJudgeId: 'jH', phase: 'final' });
    const byId = Object.fromEntries(rows.map(r => [r.team.id, r]));
    expect(byId['t1'].score).toBeCloseTo(46.8, 5);
    expect(byId['t2'].score).toBeCloseTo(46, 5); // dropped by head
    expect(rows[0].team.id).toBe('t1'); // t1 wins final
  });
  it('teams with no score rank last with null score', () => {
    const rows = computeLeaderboard({ teams, scores, headJudgeId: 'jH', phase: 'final' });
    // t3 has only j1 -> still has a score; add a team with none
    const rows2 = computeLeaderboard({
      teams: [...teams, { id: 't4', name: 'Zeta', code: 'ZT' }],
      scores, headJudgeId: 'jH', phase: 'final',
    });
    expect(rows2[rows2.length - 1].team.id).toBe('t4');
    expect(rows2[rows2.length - 1].score).toBeNull();
  });
  it('assigns golf tie ranks and breaks ties by name', () => {
    const tScores: ScoreLite[] = [
      s('j1','t1','c1',20), s('j1','t1','c2',20), // t1 = 40
      s('j1','t2','c1',20), s('j1','t2','c2',20), // t2 = 40 (tie)
      s('j1','t3','c1',10), s('j1','t3','c2',10), // t3 = 20
    ];
    const rows = computeLeaderboard({ teams, scores: tScores, headJudgeId: null, phase: 'final' });
    // t1 (CarVision? no) — tie between t1 EV Nexus and t2 CarVision at 40; name asc: CarVision before EV Nexus
    expect(rows[0].team.id).toBe('t2'); // "CarVision" < "EV Nexus"
    expect(rows[0].rank).toBe(1); expect(rows[0].tie).toBe(true);
    expect(rows[1].team.id).toBe('t1'); expect(rows[1].rank).toBe(1); expect(rows[1].tie).toBe(true);
    expect(rows[2].rank).toBe(3); expect(rows[2].tie).toBe(false);
  });
});
