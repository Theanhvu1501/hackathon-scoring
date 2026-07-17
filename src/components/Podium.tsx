'use client';

function Members({ members }: { members: any[] }) {
  if (!members || members.length === 0) return null;
  const shown = members.slice(0, 5);
  return (
    <div className="pod-members" title={members.map((m) => m.name).join(', ')}>
      {shown.map((m) => (
        <span className="pod-mem" key={m.id} title={m.name}>
          {m.photoUrl
            ? <img src={m.photoUrl} alt={m.name} />
            : <span className="pod-mem-i">{(m.name?.trim().split(' ').pop()?.[0] || '?').toUpperCase()}</span>}
        </span>
      ))}
      {members.length > shown.length && <span className="pod-mem pod-mem-more">+{members.length - shown.length}</span>}
    </div>
  );
}

export default function Podium({ rows, baremTotal }: { rows: any[]; baremTotal: number }) {
  const top = rows.filter((r) => r.score !== null).slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const cls = ['pod-2', 'pod-1', 'pod-3'];
  const medal = ['2', '1', '3'];
  return (
    <div className="podium">
      {order.map((t, i) => (
        <div className={'pod ' + cls[i] + (cls[i] === 'pod-1' ? ' pod-champion' : '')} key={i}>
          {t ? (
            <>
              <div className="pod-body">
                {cls[i] === 'pod-1' && <div className="pod-crown">👑</div>}
                <div className="pod-medal">{medal[i]}</div>
                <div className="pod-logo" style={{ background: t.team.logoUrl ? 'var(--navy-950)' : 'var(--orange)', padding: 0, overflow: 'hidden' }}>
                  {t.team.logoUrl ? <img src={t.team.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : t.team.code}
                </div>
                <div className="pod-name">{t.team.name}</div>
                <div className="pod-tag">{t.team.tag}</div>
                <div className="pod-score tnum">{t.score?.toFixed(1)}<small> /{baremTotal}</small></div>
                <Members members={t.team.members} />
              </div>
              <div className="pod-riser" />
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
