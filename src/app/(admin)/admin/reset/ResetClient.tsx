'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import Modal from '@/components/Modal';
import SnapshotPanel from './SnapshotPanel';

type Preview = {
  scoreCount: number; cardCount: number; submittedCards: number;
  commentCount: number; revealedTeams: number;
  teamCount: number; memberCount: number; judgeCount: number; activeJudgeCount: number;
  criterionCount: number; baremTotal: number; bannerImageUrl: string | null;
};

const CONFIRM_PHRASE = 'RESET';

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '7px 0', fontSize: 13.5 }}>
      <span style={{ color: ok ? 'var(--green)' : 'var(--muted-2)', fontWeight: 700, width: 14 }}>
        {ok ? '✓' : '○'}
      </span>
      <span style={{ color: 'var(--text)' }}>{children}</span>
    </li>
  );
}

export default function ResetClient() {
  const [p, setP] = useState<Preview | null>(null);
  const [modal, setModal] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState<'backup' | 'reset' | null>(null);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setP(await fetcher<Preview>('/api/reset')); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function backup() {
    setBusy('backup'); setErr('');
    try {
      download(`diem-${stamp()}.json`, await fetcher('/api/reset/backup'));
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  /**
   * Sao lưu TRƯỚC, xoá SAU — và nếu tải sao lưu hỏng thì dừng luôn, không xoá.
   * Trang này được mở giữa lúc chạy sự kiện; xoá xong mới phát hiện không có bản
   * sao lưu là tình huống không còn đường lùi.
   */
  async function doReset() {
    setBusy('reset'); setErr('');
    try {
      if (p && p.scoreCount > 0) {
        download(`diem-truoc-reset-${stamp()}.json`, await fetcher('/api/reset/backup'));
      }
      const r = await fetcher<{ counts: { scores: number; comments: number; unrevealed: number }; preview: Preview }>(
        '/api/reset', { method: 'POST', body: JSON.stringify({ confirm: CONFIRM_PHRASE }) },
      );
      setP(r.preview);
      setDone(`Đã xoá ${r.counts.scores} điểm, ${r.counts.comments} nhận xét và thu hồi ${r.counts.unrevealed} đội đã công bố.`);
      setModal(false); setTyped('');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  const empty = p !== null && p.scoreCount === 0;
  const ready = p !== null
    && p.teamCount > 0 && p.activeJudgeCount > 0 && p.criterionCount > 0
    && p.scoreCount === 0 && p.revealedTeams === 0;

  return (
    <>
      {err && <div className="note" style={{ marginBottom: 16 }}><span>!</span><div>{err}</div></div>}
      {done && (
        <div className="note" style={{ marginBottom: 16, borderColor: 'var(--green)' }}>
          <span>✓</span><div>{done}</div>
        </div>
      )}

      <div className="two-col" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div className="card card-pad">
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Sẵn sàng chạy sự kiện</h3>
          <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 10 }}>
            Trạng thái thật của hệ thống ngay lúc này. Đủ dấu ✓ là chạy được.
          </p>
          {p === null ? (
            <div style={{ display: 'grid', gap: 10, paddingTop: 6 }}>
              {Array.from({ length: 5 }, (_, i) => <span key={i} className="skel" style={{ height: 14, width: '80%' }} />)}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              <Check ok={p.teamCount > 0}>
                <b>{p.teamCount}</b> đội · <b>{p.memberCount}</b> thành viên
              </Check>
              <Check ok={p.activeJudgeCount > 0}>
                <b>{p.activeJudgeCount}</b> giám khảo đang hoạt động
                {p.judgeCount > p.activeJudgeCount && ` (${p.judgeCount - p.activeJudgeCount} đã tắt)`}
              </Check>
              <Check ok={p.criterionCount > 0}>
                <b>{p.criterionCount}</b> tiêu chí · barem <b>{p.baremTotal}</b> điểm mỗi giám khảo
              </Check>
              <Check ok={p.scoreCount === 0}>
                {p.scoreCount === 0
                  ? 'Chưa có phiếu chấm nào'
                  : <><b>{p.cardCount}</b> phiếu đã chấm ({p.submittedCards} đã nộp) · <b>{p.commentCount}</b> nhận xét</>}
              </Check>
              <Check ok={p.revealedTeams === 0}>
                {p.revealedTeams === 0 ? 'Board đang ở màn chờ' : <>Board đã công bố <b>{p.revealedTeams}</b> đội</>}
              </Check>
              <Check ok={!!p.bannerImageUrl}>
                {p.bannerImageUrl ? 'Banner màn chờ đã cấu hình' : 'Chưa đặt banner màn chờ (dùng màn chờ mặc định)'}
              </Check>
            </ul>
          )}
          {ready && (
            <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>
              Hệ thống sạch và sẵn sàng cho sự kiện.
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card card-pad">
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Sao lưu điểm</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
              Tải toàn bộ điểm và nhận xét về máy dưới dạng <code>.json</code>. Nút đặt lại bên dưới
              cũng <b>tự tải một bản</b> trước khi xoá — đây là nút để chủ động lưu bất cứ lúc nào.
            </p>
            <button className="btn btn-sm" disabled={!!busy || empty} aria-busy={busy === 'backup'} onClick={backup}>
              {busy === 'backup' ? <><span className="spin" /> Đang tải</> : '⤓ Tải bản sao lưu (.json)'}
            </button>
            {empty && <div className="hint" style={{ marginTop: 8 }}>Chưa có điểm nào để sao lưu.</div>}
          </div>

          <div className="card card-pad" style={{ borderColor: 'var(--red)' }}>
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Đặt lại phần chấm điểm</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 12 }}>
              Dùng sau khi chạy thử, để bắt đầu sự kiện thật từ con số không.
            </p>
            <div style={{ fontSize: 12.5, lineHeight: 1.9, marginBottom: 14 }}>
              <div><b style={{ color: 'var(--red)' }}>Xoá:</b> toàn bộ điểm, nhận xét của BGK, trạng thái đã công bố</div>
              <div><b style={{ color: 'var(--green)' }}>Giữ:</b> đội thi, thành viên, giám khảo, mã truy cập, barem, banner</div>
            </div>
            <button className="btn btn-danger btn-sm" disabled={!!busy || p === null || (empty && p.revealedTeams === 0)}
              onClick={() => { setTyped(''); setErr(''); setModal(true); }}>
              ↺ Đặt lại phần chấm điểm
            </button>
            {p !== null && empty && p.revealedTeams === 0 && (
              <div className="hint" style={{ marginTop: 8 }}>Không có gì để đặt lại — hệ thống đã sạch.</div>
            )}
          </div>
        </div>
      </div>

      {/* Khôi phục có thể tạo lại đội/BGK bị xoá, nên checklist phía trên phải
          tải lại sau đó — nếu không nó hiện số cũ và người vận hành tưởng khôi
          phục không ăn. */}
      <SnapshotPanel onChanged={load} />

      {modal && p !== null && (
        <Modal
          title="Đặt lại phần chấm điểm"
          maxWidth={470}
          onClose={() => { if (!busy) { setModal(false); setTyped(''); } }}
          footer={<>
            <button className="btn" disabled={!!busy} onClick={() => { setModal(false); setTyped(''); }}>Huỷ</button>
            <button className="btn btn-danger" disabled={typed.trim().toUpperCase() !== CONFIRM_PHRASE || !!busy}
              aria-busy={busy === 'reset'} onClick={doReset}>
              {busy === 'reset' ? <><span className="spin" /> Đang đặt lại</> : 'Đặt lại'}
            </button>
          </>}
        >
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>
            Sắp xoá <b>{p.scoreCount}</b> dòng điểm thuộc <b>{p.cardCount}</b> phiếu chấm
            ({p.submittedCards} phiếu đã nộp), <b>{p.commentCount}</b> nhận xét, và thu hồi{' '}
            <b>{p.revealedTeams}</b> đội đã công bố.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted)', marginTop: 10 }}>
            <b>{p.teamCount}</b> đội và <b>{p.judgeCount}</b> giám khảo được giữ nguyên, kể cả mã truy cập.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted-2)', marginTop: 10 }}>
            Một bản sao lưu <code>.json</code> sẽ tự tải về máy trước khi xoá. Thao tác này không hoàn tác được.
          </p>
          <label style={{ display: 'block', marginTop: 14, fontSize: 13, fontWeight: 600 }}>
            Gõ <code>{CONFIRM_PHRASE}</code> để xác nhận
          </label>
          <input className="input" style={{ marginTop: 6 }} value={typed} autoFocus disabled={!!busy}
            placeholder={CONFIRM_PHRASE} onChange={(e) => setTyped(e.target.value)} />
        </Modal>
      )}
    </>
  );
}
