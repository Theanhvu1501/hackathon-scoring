import { prisma } from '@/lib/db';
import { judgeProgress } from '@/lib/services/scores';
import { TeamLogo } from '@/components/Avatar';
export const dynamic = 'force-dynamic';
export default async function Dashboard() {
  const [teams, judges, progress] = await Promise.all([
    prisma.team.findMany({ orderBy:{ createdAt:'asc' } }),
    prisma.user.findMany({ where:{ role:'judge' }, orderBy:{ createdAt:'asc' } }),
    judgeProgress(),
  ]);
  const done = new Set(progress.filter(p=>p.submitted).map(p=>p.judgeId+':'+p.teamId));
  return (
    <>
      <div className="card"><div className="matrix"><table>
        <thead><tr><th>Đội</th>{judges.map(j=><th key={j.id} style={{textAlign:'center'}}>{j.name.split(' ').pop()}{j.isHead?' ♛':''}</th>)}</tr></thead>
        <tbody>
          {teams.map(t=>(
            <tr key={t.id}><td><div className="tcell"><TeamLogo code={t.code} logoUrl={t.logoUrl} /><b>{t.name}</b></div></td>
            {judges.map(j=>(<td key={j.id} style={{textAlign:'center'}}>
              <span className={'cellstat '+(done.has(j.id+':'+t.id)?'cs-done':'cs-wait')}>{done.has(j.id+':'+t.id)?'✓':''}</span>
            </td>))}
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </>
  );
}
