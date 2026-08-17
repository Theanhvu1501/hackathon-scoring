'use client';
import { teamMark, projectVisual, teamHue, memberGradient, initials } from '@/lib/team-art';

type Member = { id: string; name: string; photoUrl?: string | null; teamRole?: string | null };
type Row = {
  score: number | null;
  team: { name: string; code: string; tag?: string | null; logoUrl?: string | null; members?: Member[] };
};

// The team everything else is measured against, shown as a showcase:
// project visual, team mark, crew. Uploaded images take priority over the
// generated stand-ins.
export default function LeaderBand({
  row, maxTotal, isChampion, heroImageUrl,
}: {
  row: Row; maxTotal: number;
  /** true khi ĐÃ công bố hết các đội — lúc đó đội đứng đầu mới thật là vô địch.
   *  Giữa lúc công bố lần lượt thì nó chỉ là đội dẫn đầu trong số đã công bố. */
  isChampion: boolean;
  heroImageUrl?: string | null;
}) {
  const t = row.team;
  const crew = (t.members ?? []).slice(0, 6);
  const hue = teamHue(t.code);
  const visual = heroImageUrl || projectVisual(t.code);
  const mark = t.logoUrl || teamMark(t.code);

  return (
    <div
      className={'pw-lead' + (isChampion ? ' is-champion' : '')}
      style={{ ['--pw-hue' as any]: hue }}
    >
      <div className="pw-lead-visual">
        <img src={visual} alt="" />
        <span className="pw-lead-mark"><img src={mark} alt="" /></span>
      </div>

      <div className="pw-lead-txt">
        <div className="pw-lead-label">
          <span className="pw-chip">{isChampion ? 'CHAMPION / 2026' : 'ĐANG DẪN ĐẦU'}</span>
        </div>
        <div className="pw-lead-name">{t.name}</div>
        {t.tag && <div className="pw-lead-tag">{t.tag}</div>}

        {crew.length > 0 && (
          <div className="pw-crew">
            {crew.map((m) => (
              <span className="pw-crew-m" key={m.id} title={m.teamRole ? `${m.name} · ${m.teamRole}` : m.name}>
                <i className="ph" style={m.photoUrl ? undefined : { background: memberGradient(m.name) }}>
                  {m.photoUrl ? <img src={m.photoUrl} alt="" /> : initials(m.name)}
                </i>
                <b>{m.name}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pw-lead-score">
        <span className="n">{row.score === null ? '—' : row.score.toFixed(1)}</span>
        <span className="of">/ {maxTotal} ĐIỂM</span>
      </div>
    </div>
  );
}
