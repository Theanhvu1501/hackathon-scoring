'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import ImagePicker from '@/components/ImagePicker';
import { TeamLogo } from '@/components/Avatar';
import { useConfirm } from '@/components/ConfirmProvider';

type Row = {
  team: { id: string; name: string; code: string; logoUrl: string | null };
  score: number | null; rank: number; tie: boolean;
};

export default function Publish() {
  const [rows, setRows] = useState<Row[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [judgesShown, setJudgesShown] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [hero, setHero] = useState('');
  const [banner, setBanner] = useState('');
  const confirm = useConfirm();

  const load = useCallback(async () => {
    const [res, rev, img] = await Promise.all([
      fetcher('/api/results/all'), fetcher('/api/reveal'), fetcher('/api/board/image'),
    ]);
    setRows(res.rows);
    setRevealed(new Set(rev.revealedTeamIds));
    setJudgesShown(rev.judgeScoresRevealed);
    setHero(img.heroImageUrl || '');
    setBanner(img.bannerImageUrl || '');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: any, key: string) {
    setBusy(key);
    try {
      await fetcher('/api/reveal', { method: 'POST', body: JSON.stringify(body) });
      await load();
    } finally { setBusy(null); }
  }

  async function revealJudges() {
    if (!(await confirm({
      title: 'Công bố điểm ban giám khảo',
      message: 'Board sẽ hiện điểm của từng giám khảo (ẩn tên) cho mọi đội đã công bố. Xác nhận?',
      confirmText: 'Công bố',
    }))) return;
    await act({ action: 'revealJudges' }, 'judges');
  }

  async function reset() {
    if (!(await confirm({
      title: 'Reset về màn chờ',
      message: 'Thu hồi toàn bộ đội đã công bố và tắt điểm BGK. Board quay lại màn chờ. Điểm đã chấm không bị ảnh hưởng.',
      confirmText: 'Reset', danger: true,
    }))) return;
    await act({ action: 'reset' }, 'reset');
  }

  // Hạng bét lên đầu: ban tổ chức xướng tên từ dưới lên.
  const order = [...rows].sort((a, b) => b.rank - a.rank);
  const doneCount = revealed.size;

  return (
    <>
      <div className="stepper">
        <div className={'step ' + (doneCount > 0 ? 'done' : 'active')}>
          <div className="step-n">{doneCount > 0 ? '✓' : '1'}</div><h4>Công bố thứ hạng</h4>
        </div>
        <div className={'step ' + (judgesShown ? 'done' : doneCount > 0 ? 'active' : '')}>
          <div className="step-n">{judgesShown ? '✓' : '2'}</div><h4>Công bố điểm BGK</h4>
        </div>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start', marginTop: 20 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 15 }}>Bước 1 · Công bố từng đội</h3>
              <span className={'pill ' + (doneCount === rows.length && rows.length > 0 ? 'done' : 'pending')}>
                Đã công bố {doneCount}/{rows.length}
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
              Sắp sẵn từ hạng bét lên hạng nhất. Ấn <b>Công bố</b> là board bật màn hình hạng
              của đội đó rồi đọng lại thành bảng xếp hạng.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Hạng</th>
                    <th>Đội</th>
                    <th style={{ textAlign: 'right' }}>Điểm</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {order.map((r) => {
                    const on = revealed.has(r.team.id);
                    return (
                      <tr key={r.team.id} style={on ? { opacity: .55 } : undefined}>
                        <td className="tnum"><b>{r.tie ? 'T' : ''}{r.rank}</b></td>
                        <td>
                          <div className="tcell">
                            <TeamLogo code={r.team.code} logoUrl={r.team.logoUrl} />
                            <b>{r.team.name}</b>
                          </div>
                        </td>
                        <td className="tnum" style={{ textAlign: 'right' }}>
                          {r.score === null ? '—' : r.score.toFixed(1)}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {on ? (
                            <button className="btn btn-sm" disabled={busy === r.team.id}
                              onClick={() => act({ action: 'unrevealTeam', teamId: r.team.id }, r.team.id)}>
                              ↩ Thu hồi
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-primary" disabled={busy === r.team.id}
                              onClick={() => act({ action: 'revealTeam', teamId: r.team.id }, r.team.id)}>
                              ▶ Công bố
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={4} style={{ color: 'var(--muted-2)' }}>Chưa có đội nào.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Bước 2 · Công bố điểm ban giám khảo</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
              Board bung điểm của từng giám khảo dưới mỗi đội, hiện nhãn <b>BGK Chính / BGK 1 / BGK 2…</b>,
              không hiện tên thật.
            </p>
            {judgesShown ? (
              <div className="note">
                <span style={{ color: 'var(--green)' }}>✓</span>
                <div><b style={{ color: 'var(--text)' }}>Đã công bố điểm BGK.</b></div>
              </div>
            ) : (
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }}
                disabled={doneCount === 0 || busy === 'judges'} onClick={revealJudges}>
                ♛ Công bố điểm ban giám khảo
              </button>
            )}
            {doneCount === 0 && !judgesShown && (
              <div className="hint" style={{ marginTop: 10 }}>Công bố ít nhất một đội trước đã.</div>
            )}
          </div>

          <div className="card card-pad">
            <button className="btn btn-danger btn-sm" disabled={busy === 'reset'} onClick={reset}>
              ↺ Reset về màn chờ
            </button>
            <a className="btn btn-sm" style={{ marginLeft: 10 }} href="/board" target="_blank">
              Xem bảng công khai →
            </a>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card card-pad">
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Banner màn chờ</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
              Phủ kín trang board khi <b>chưa công bố đội nào</b>. Nên là ảnh ngang, tỉ lệ 16:9.
              Bỏ trống thì dùng màn chờ mặc định.
            </p>
            <ImagePicker value={banner} size={120} max={1600} placeholder="＋ Banner"
              onChange={async (v) => {
                setBanner(v);
                await fetcher('/api/board/image', { method: 'POST', body: JSON.stringify({ bannerImageUrl: v || null }) });
              }} />
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Ảnh nền màn chiếu</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
              Ảnh ở panel bên trái của bảng điểm khi đang chạy (nên là ảnh dọc/chân dung).
            </p>
            <ImagePicker value={hero} size={120} max={900} placeholder="＋ Ảnh"
              onChange={async (v) => {
                setHero(v);
                await fetcher('/api/board/image', { method: 'POST', body: JSON.stringify({ imageUrl: v || null }) });
              }} />
          </div>
        </div>
      </div>
    </>
  );
}
