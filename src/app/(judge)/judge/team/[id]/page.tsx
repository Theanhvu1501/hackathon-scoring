'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import { TeamLogo, MemberAvatar } from '@/components/Avatar';

type Member = {
  id: string; name: string; teamRole: string | null; photoUrl: string | null;
  org: string | null; intro: string | null;
};
type Team = {
  id: string; name: string; code: string; tag: string | null; logoUrl: string | null;
  members: Member[];
};

export default function JudgeTeamDetail({ params }: { params: { id: string } }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetcher<Team>('/api/teams/' + params.id).then(setTeam).catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return <div className="card card-pad" style={{ color: 'var(--muted)' }}>Không tải được đội: {err}</div>;
  if (!team) return <div>Đang tải…</div>;

  return (
    <>
      <div className="page-head">
        <div className="tcell">
          <TeamLogo code={team.code} logoUrl={team.logoUrl} size={46} />
          <div>
            <div className="page-title">{team.name}</div>
            <small style={{ color: 'var(--muted-2)' }}>
              {team.tag || `${team.members.length} thành viên`}
            </small>
          </div>
        </div>
        <Link className="btn btn-primary" href={'/judge/score/' + team.id}>Chấm điểm đội này →</Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
        {team.members.map((m) => (
          <div key={m.id} className="card card-pad">
            <div className="tcell">
              <MemberAvatar name={m.name} photoUrl={m.photoUrl} />
              <div>
                <b>{m.name}</b>
                <small style={{ display: 'block', color: 'var(--muted-2)' }}>{m.teamRole || '—'}</small>
              </div>
            </div>
            {m.org && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>{m.org}</p>}
            {m.intro && <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 6, lineHeight: 1.55 }}>{m.intro}</p>}
          </div>
        ))}
        {team.members.length === 0 && (
          <div className="card card-pad" style={{ color: 'var(--muted-2)' }}>Đội chưa có thành viên.</div>
        )}
      </div>
    </>
  );
}
