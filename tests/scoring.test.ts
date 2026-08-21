import { describe, it, expect } from 'vitest';
import { judgeTotal, teamTotal, computeLeaderboard, ScoreLite, TeamLite } from '@/lib/scoring';

const teams: TeamLite[] = [
  { id: 't1', name: 'EV Nexus', code: 'EV' },
  { id: 't2', name: 'CarVision', code: 'CV' },
  { id: 't3', name: 'RoadMind', code: 'RM' },
];
// 5 giám khảo ngang nhau: j1..j4 chấm sát nhau, j5 lệch hẳn ra. Fixture cố ý
// để một người lệch nhiều — t1 (j5 cho cao) phải vượt t2 (j5 cho thấp).
function s(judgeId:string, teamId:string, criterionId:string, value:number): ScoreLite {
  return { judgeId, teamId, criterionId, value };
}
// two criteria c1(max25) c2(max25)
const scores: ScoreLite[] = [
  // t1: j1..j4 give totals 46 each, j5 gives 50 -> 234
  s('j1','t1','c1',23), s('j1','t1','c2',23),
  s('j2','t1','c1',22), s('j2','t1','c2',24),
  s('j3','t1','c1',23), s('j3','t1','c2',23),
  s('j4','t1','c1',24), s('j4','t1','c2',22),
  s('j5','t1','c1',25), s('j5','t1','c2',25),
  // t2: j1..j4 totals 48,48,47,47 -> 190; j5 gives 40 -> 230
  s('j1','t2','c1',24), s('j1','t2','c2',24),
  s('j2','t2','c1',24), s('j2','t2','c2',24),
  s('j3','t2','c1',24), s('j3','t2','c2',23),
  s('j4','t2','c1',24), s('j4','t2','c2',23),
  s('j5','t2','c1',20), s('j5','t2','c2',20),
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

describe('teamTotal', () => {
  it('sums every judge total', () => {
    // t1: 46+46+46+46+50 = 234
    expect(teamTotal(scores, 't1').total).toBeCloseTo(234, 5);
    expect(teamTotal(scores, 't1').judgeCount).toBe(5);
  });
  it('never holds a judge back — every judge is always counted', () => {
    // Trước đây teamTotal nhận { excludeJudgeId } để giữ kín điểm một giám khảo.
    // Cơ chế đó đã bỏ: chỉ còn một con số duy nhất cho mỗi đội.
    expect(teamTotal(scores, 't2').total).toBeCloseTo(230, 5);
    expect(teamTotal(scores, 't2').judgeCount).toBe(5);
  });
  it('does not divide by judge count — a partly scored team stays low', () => {
    // t3 has a single judge at 40. Averaging would have shown 40 (mid-table);
    // summing keeps it at 40 while fully scored teams climb past 180.
    expect(teamTotal(scores, 't3').total).toBeCloseTo(40, 5);
    expect(teamTotal(scores, 't3').judgeCount).toBe(1);
  });
  it('returns null total for team with no scores', () => {
    expect(teamTotal(scores, 'tX').total).toBeNull();
  });
});

describe('computeLeaderboard', () => {
  it('ranks by the one and only total, every judge included', () => {
    const rows = computeLeaderboard({ teams, scores });
    const byId = Object.fromEntries(rows.map(r => [r.team.id, r]));
    expect(byId['t1'].score).toBeCloseTo(234, 5);
    expect(byId['t2'].score).toBeCloseTo(230, 5);
    expect(rows[0].team.id).toBe('t1');
    expect(rows[0].rank).toBe(1);
    expect(rows[1].team.id).toBe('t2');
    expect(rows[1].rank).toBe(2);
  });
  it('teams with no score rank last with null score', () => {
    const rows = computeLeaderboard({
      teams: [...teams, { id: 't4', name: 'Zeta', code: 'ZT' }],
      scores,
    });
    expect(rows[rows.length - 1].team.id).toBe('t4');
    expect(rows[rows.length - 1].score).toBeNull();
  });
  it('assigns golf tie ranks and breaks ties by name', () => {
    const tScores: ScoreLite[] = [
      s('j1','t1','c1',20), s('j1','t1','c2',20), // t1 = 40
      s('j1','t2','c1',20), s('j1','t2','c2',20), // t2 = 40 (tie)
      s('j1','t3','c1',10), s('j1','t3','c2',10), // t3 = 20
    ];
    const rows = computeLeaderboard({ teams, scores: tScores });
    // tie between t1 "EV Nexus" and t2 "CarVision" at 40; name asc puts CarVision first
    expect(rows[0].team.id).toBe('t2');
    expect(rows[0].rank).toBe(1); expect(rows[0].tie).toBe(true);
    expect(rows[1].team.id).toBe('t1'); expect(rows[1].rank).toBe(1); expect(rows[1].tie).toBe(true);
    expect(rows[2].rank).toBe(3); expect(rows[2].tie).toBe(false);
  });
});
