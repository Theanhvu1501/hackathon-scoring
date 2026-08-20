'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmProvider';

type Info = {
  id: string; label: string; actorName: string | null; createdAt: string;
  teamCount: number; memberCount: number; judgeCount: number; criterionCount: number;
};
type Payload = {
  teams: { id: string; name: string }[];
  users: { id: string; name: string; role: string }[];
};

const CONFIRM_PHRASE = 'KHOI PHUC';

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
function viTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function SnapshotPanel({ onChanged }: { onChanged?: () => void }) {
  const [list, setList] = useState<Info[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  // Bản chụp đang chờ khôi phục, kèm danh sách thứ sẽ bị xoá — tính khi mở modal.
  const [target, setTarget] = useState<{ info: Info; extraTeams: string[]; extraUsers: string[] } | null>(null);
  const [typed, setTyped] = useState('');
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try { setList((await fetcher<{ snapshots: Info[] }>('/api/snapshot')).snapshots); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function capture() {
    setBusy('capture'); setErr(''); setOk('');
    try {
      const r = await fetcher<{ snapshot: Info; payload: unknown }>(
        '/api/snapshot', { method: 'POST', body: JSON.stringify({ label: label.trim() }) },
      );
      download(`chuan-bi-${stamp()}.json`, r.payload);
      setLabel('');
      setOk(`Đã chụp "${r.snapshot.label}" — ${r.snapshot.teamCount} đội, ${r.snapshot.judgeCount} giám khảo. Một bản .json đã tải về máy.`);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function save(s: Info) {
    setBusy(s.id); setErr('');
    try { download(`chuan-bi-${stamp(new Date(s.createdAt))}.json`, await fetcher(`/api/snapshot/${s.id}`)); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  /**
   * Tính trước CHÍNH XÁC thứ sẽ bị xoá rồi mới hiện modal. Câu cảnh báo chung
   * chung kiểu 'dữ liệu thêm sau sẽ mất' không đủ để người vận hành dám bấm giữa
   * sự kiện — họ cần thấy đúng tên đội nào sắp biến mất.
   */
  async function openRestore(s: Info) {
    setBusy(s.id); setErr('');
    try {
      const [snap, teams, judges] = await Promise.all([
        fetcher<Payload>(`/api/snapshot/${s.id}`),
        fetcher<{ id: string; name: string }[]>('/api/teams'),
        fetcher<{ id: string; name: string }[]>('/api/judges'),
      ]);
      const snapTeams = new Set(snap.teams.map((t) => t.id));
      const snapUsers = new Set(snap.users.map((u) => u.id));
      setTarget({
        info: s,
        extraTeams: teams.filter((t) => !snapTeams.has(t.id)).map((t) => t.name),
        extraUsers: judges.filter((j) => !snapUsers.has(j.id)).map((j) => j.name),
      });
      setTyped('');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function doRestore() {
    if (!target) return;
    setBusy('restore'); setErr('');
    try {
      const r = await fetcher<{ counts: { teamsRestored: number; teamsDeleted: number; usersDeleted: number } }>(
        `/api/snapshot/${target.info.id}/restore`,
        { method: 'POST', body: JSON.stringify({ confirm: CONFIRM_PHRASE }) },
      );
      setOk(`Đã khôi phục ${r.counts.teamsRestored} đội về bản "${target.info.label}".`
        + (r.counts.teamsDeleted || r.counts.usersDeleted
          ? ` Xoá ${r.counts.teamsDeleted} đội và ${r.counts.usersDeleted} tài khoản thêm sau lúc chụp.` : ''));
      setTarget(null); setTyped('');
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function del(s: Info) {
    if (!(await confirm({
      title: 'Xoá bản chụp',
      message: `Xoá bản "${s.label}"? Dữ liệu đang chạy không bị ảnh hưởng, chỉ mất khả năng khôi phục về mốc này.`,
      confirmText: 'Xoá', danger: true,
    }))) return;
    setBusy(s.id); setErr('');
    try { await fetcher(`/api/snapshot/${s.id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>Bản chụp dữ liệu chuẩn bị</h3>
      <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14, maxWidth: 760, lineHeight: 1.7 }}>
        Chụp lại <b>đội, thành viên, ban giám khảo, mã truy cập, barem và banner</b> tại thời điểm mọi thứ đã đúng.
        Nếu sau đó có ai sửa hoặc xoá nhầm, bấm <b>Khôi phục</b> là về lại đúng mốc đó.
        Khôi phục <b>không đụng tới điểm đã chấm</b> — dùng được ngay cả khi ban giám khảo đang chấm dở.
      </p>

      {err && <div className="note" style={{ marginBottom: 14 }}><span>!</span><div>{err}</div></div>}
      {ok && <div className="note" style={{ marginBottom: 14, borderColor: 'var(--green)' }}><span>✓</span><div>{ok}</div></div>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 300 }} value={label} disabled={!!busy}
          placeholder="Tên bản chụp, ví dụ: Chốt dữ liệu tối 19/8"
          onChange={(e) => setLabel(e.target.value)} />
        <button className="btn btn-primary btn-sm" disabled={!!busy} aria-busy={busy === 'capture'} onClick={capture}>
          {busy === 'capture' ? <><span className="spin" /> Đang chụp</> : '⛁ Chụp bản chuẩn bị'}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Bản chụp</th>
              <th>Nội dung</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {list === null && Array.from({ length: 2 }, (_, i) => (
              <tr key={'s' + i}>
                <td><span className="skel" style={{ width: '60%' }} /></td>
                <td><span className="skel" style={{ width: '70%' }} /></td>
                <td><span className="skel" style={{ width: 140, marginLeft: 'auto' }} /></td>
              </tr>
            ))}
            {list?.map((s) => (
              <tr key={s.id}>
                <td>
                  <b>{s.label}</b>
                  <small style={{ display: 'block', color: 'var(--muted-2)' }}>
                    {viTime(s.createdAt)}{s.actorName ? ` · ${s.actorName}` : ''}
                  </small>
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                  {s.teamCount} đội · {s.memberCount} thành viên · {s.judgeCount} BGK · {s.criterionCount} tiêu chí
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm" disabled={!!busy} onClick={() => save(s)}>⤓ Tải</button>{' '}
                  <button className="btn btn-sm" disabled={!!busy} aria-busy={busy === s.id}
                    onClick={() => openRestore(s)}>↺ Khôi phục</button>{' '}
                  <button className="btn btn-sm btn-danger" disabled={!!busy} onClick={() => del(s)}>Xoá</button>
                </td>
              </tr>
            ))}
            {list !== null && list.length === 0 && (
              <tr><td colSpan={3} style={{ color: 'var(--muted-2)' }}>
                Chưa có bản chụp nào. Nhập xong dữ liệu thì chụp một bản trước khi sự kiện bắt đầu.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {target && (
        <Modal
          title="Khôi phục dữ liệu chuẩn bị"
          maxWidth={500}
          onClose={() => { if (!busy) { setTarget(null); setTyped(''); } }}
          footer={<>
            <button className="btn" disabled={!!busy} onClick={() => { setTarget(null); setTyped(''); }}>Huỷ</button>
            <button className="btn btn-danger" disabled={typed.trim().toUpperCase() !== CONFIRM_PHRASE || !!busy}
              aria-busy={busy === 'restore'} onClick={doRestore}>
              {busy === 'restore' ? <><span className="spin" /> Đang khôi phục</> : 'Khôi phục'}
            </button>
          </>}
        >
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>
            Đưa đội, thành viên, ban giám khảo, mã truy cập, barem và banner về đúng bản{' '}
            <b>{target.info.label}</b> ({viTime(target.info.createdAt)}).
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--green)', marginTop: 10 }}>
            Điểm đã chấm của các đội trong bản chụp <b>không bị đụng tới</b>.
          </p>

          {(target.extraTeams.length > 0 || target.extraUsers.length > 0) ? (
            <div className="note" style={{ marginTop: 12 }}>
              <span>!</span>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                Những thứ được thêm sau lúc chụp sẽ bị <b>xoá</b>:
                {target.extraTeams.length > 0 && (
                  <div>· Đội: <b>{target.extraTeams.join(', ')}</b> — kèm toàn bộ điểm của các đội này</div>
                )}
                {target.extraUsers.length > 0 && (
                  <div>· Giám khảo: <b>{target.extraUsers.join(', ')}</b> — kèm điểm họ đã chấm</div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 12 }}>
              Không có đội hay giám khảo nào được thêm sau lúc chụp, nên không có gì bị xoá.
            </p>
          )}

          <label style={{ display: 'block', marginTop: 14, fontSize: 13, fontWeight: 600 }}>
            Gõ <code>{CONFIRM_PHRASE}</code> để xác nhận
          </label>
          <input className="input" style={{ marginTop: 6 }} value={typed} autoFocus disabled={!!busy}
            placeholder={CONFIRM_PHRASE} onChange={(e) => setTyped(e.target.value)} />
        </Modal>
      )}
    </div>
  );
}
