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
type Status = { revealedTeamIds: string[]; currentTeamId: string | null; currentTeamName: string | null };

export default function Publish() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [st, setSt] = useState<Status>({ revealedTeamIds: [], currentTeamId: null, currentTeamName: null });
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const confirm = useConfirm();

  const load = useCallback(async () => {
    const [res, rev, img] = await Promise.all([
      fetcher('/api/results/all'), fetcher('/api/reveal'), fetcher('/api/board/image'),
    ]);
    setRows(res.rows);
    setSt(rev);
    setBanner(img.bannerImageUrl || '');
  }, []);
  useEffect(() => { load(); }, [load]);

  /**
   * Chỉ cập nhật trạng thái công bố từ CHÍNH response của POST, không gọi lại
   * /api/results/all. Trước đây mỗi lần bấm là fetch lại cả ba endpoint rồi
   * thay toàn bộ mảng rows — React dựng lại cả bảng nên màn hình nháy một cái.
   * Bảng xếp hạng không đổi khi công bố, nên không có lý do gì tải lại nó.
   */
  async function act(body: any, key: string) {
    setBusy(key); setErr('');
    try {
      const r = await fetcher<Status>('/api/reveal', { method: 'POST', body: JSON.stringify(body) });
      setSt({ revealedTeamIds: r.revealedTeamIds, currentTeamId: r.currentTeamId, currentTeamName: r.currentTeamName });
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function reset() {
    if (!(await confirm({
      title: 'Đưa board về màn chờ',
      message: 'Thu hồi toàn bộ đội đã công bố. Board quay lại màn chờ và bạn công bố lại từ đầu. Điểm đã chấm không bị ảnh hưởng.',
      confirmText: 'Về màn chờ', danger: true,
    }))) return;
    await act({ action: 'reset' }, 'reset');
  }

  async function saveBanner(v: string) {
    setBanner(v); setErr('');
    try { await fetcher('/api/board/image', { method: 'POST', body: JSON.stringify({ bannerImageUrl: v || null }) }); }
    catch (e: any) { setErr(e.message); }
  }

  // Hạng bét lên đầu: ban tổ chức xướng tên từ dưới lên.
  const order = rows ? [...rows].sort((a, b) => b.rank - a.rank) : [];
  const done = new Set(st.revealedTeamIds);
  const total = rows?.length ?? 0;

  return (
    <>
      {err && <div className="note" style={{ marginBottom: 16 }}><span>!</span><div>{err}</div></div>}

      <div className="two-col" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Board giữ nguyên đội cuối cùng được công bố, nên người điều khiển
              phải thấy được đang chiếu ai mà không cần ngoái sang màn hình lớn. */}
          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted-2)' }}>
                  Đang chiếu trên board
                </div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, marginTop: 6, color: 'var(--text)' }}>
                  {rows === null
                    ? <span className="skel" style={{ width: 180, height: 20 }} />
                    : st.currentTeamName ?? 'Màn chờ'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={'pill ' + (done.size === total && total > 0 ? 'done' : 'pending')}>
                  {rows === null ? '…' : `Đã công bố ${done.size}/${total}`}
                </span>
                <a className="btn btn-sm" href="/board" target="_blank">Mở board ↗</a>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Công bố từng đội</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
              Sắp sẵn từ hạng bét lên hạng nhất. Ấn <b>Công bố</b> là board chuyển sang đội đó —
              thứ hạng, tên, logo và điểm từng giám khảo — và giữ nguyên tới lần công bố kế tiếp.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 62 }}>Hạng</th>
                    <th>Đội</th>
                    <th style={{ textAlign: 'right' }}>Điểm</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows === null && Array.from({ length: 5 }, (_, i) => (
                    <tr key={'s' + i}>
                      <td><span className="skel" style={{ width: 24 }} /></td>
                      <td><span className="skel" style={{ width: '55%' }} /></td>
                      <td><span className="skel" style={{ width: 38, marginLeft: 'auto' }} /></td>
                      <td><span className="skel" style={{ width: 84, marginLeft: 'auto' }} /></td>
                    </tr>
                  ))}

                  {order.map((r) => {
                    const on = done.has(r.team.id);
                    const isCurrent = st.currentTeamId === r.team.id;
                    const working = busy === r.team.id;
                    return (
                      <tr key={r.team.id} style={isCurrent ? { background: 'rgba(243,112,33,.06)' } : undefined}>
                        <td className="tnum"><b>{r.tie ? 'T' : ''}{r.rank}</b></td>
                        <td>
                          <div className="tcell">
                            <TeamLogo code={r.team.code} logoUrl={r.team.logoUrl} />
                            <span>
                              <b>{r.team.name}</b>
                              {isCurrent && (
                                <small style={{ display: 'block', color: 'var(--orange)', fontWeight: 600 }}>
                                  đang chiếu
                                </small>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="tnum" style={{ textAlign: 'right' }}>
                          {r.score === null ? '—' : r.score.toFixed(1)}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {on ? (
                            <>
                              {!isCurrent && (
                                <>
                                  <button className="btn btn-sm" disabled={!!busy} aria-busy={working}
                                    onClick={() => act({ action: 'revealTeam', teamId: r.team.id }, r.team.id)}>
                                    {working ? <><span className="spin" /> Đang chiếu lại</> : 'Chiếu lại'}
                                  </button>{' '}
                                </>
                              )}
                              <button className="btn btn-sm" disabled={!!busy} aria-busy={working}
                                onClick={() => act({ action: 'unrevealTeam', teamId: r.team.id }, r.team.id)}>
                                {working && isCurrent ? <><span className="spin" /> Đang thu hồi</> : '↩ Thu hồi'}
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-sm btn-primary" disabled={!!busy} aria-busy={working}
                              onClick={() => act({ action: 'revealTeam', teamId: r.team.id }, r.team.id)}>
                              {working ? <><span className="spin" /> Đang công bố</> : '▶ Công bố'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {rows !== null && rows.length === 0 && (
                    <tr><td colSpan={4} style={{ color: 'var(--muted-2)' }}>Chưa có đội nào. Thêm đội ở mục Quản lý đội thi.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card card-pad">
            <button className="btn btn-danger btn-sm" disabled={!!busy || done.size === 0} aria-busy={busy === 'reset'}
              onClick={reset}>
              {busy === 'reset' ? <><span className="spin" /> Đang thu hồi</> : '↺ Đưa board về màn chờ'}
            </button>
          </div>
        </div>

        <div className="card card-pad">
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Banner màn chờ</h3>
          <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
            Phủ kín trang board khi <b>chưa công bố đội nào</b>. Nên là ảnh ngang, tỉ lệ 16:9.
            Bỏ trống thì dùng màn chờ mặc định.
          </p>
          <ImagePicker value={banner} size={120} max={1600} placeholder="＋ Banner" onChange={saveBanner} />
        </div>
      </div>
    </>
  );
}
