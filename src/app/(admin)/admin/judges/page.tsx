'use client';
import { Fragment, useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmProvider';

type Judge = { id: string; name: string; accessCode: string };
type Criterion = { id: string; name: string; maxScore: number; order: number };
type DetailRow = {
  teamId: string; teamName: string; teamCode: string;
  values: Record<string, number>; total: number | null;
  status: 'submitted' | 'draft' | 'none';
  comment: string;
};
type Detail = { criteria: Criterion[]; rows: DetailRow[] };

const STATUS_LABEL: Record<DetailRow['status'], string> = {
  submitted: 'Đã nộp', draft: 'Nháp', none: 'Chưa chấm',
};

export default function Judges() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [modal, setModal] = useState<null | 'add' | Judge>(null);
  const [form, setForm] = useState({ name: '', accessCode: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [detailOf, setDetailOf] = useState<Judge | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const confirm = useConfirm();

  async function load() { setJudges(await fetcher('/api/judges')); }
  useEffect(() => { load(); }, []);

  function openAdd() { setForm({ name: '', accessCode: '' }); setErr(''); setModal('add'); }
  function openEdit(j: Judge) { setForm({ name: j.name, accessCode: j.accessCode }); setErr(''); setModal(j); }
  async function openDetail(j: Judge) {
    setDetailOf(j); setDetail(null);
    setDetail(await fetcher('/api/judges/' + j.id + '/scores'));
  }

  async function save() {
    if (!form.name.trim()) return;
    const j = modal !== 'add' && modal ? (modal as Judge) : null;
    // Đổi mã là hành động không hoàn tác được với người đang giữ mã cũ — phải hỏi.
    if (j && form.accessCode !== j.accessCode) {
      if (!(await confirm({
        title: 'Đổi mã truy cập',
        message: `Mã ${j.accessCode} sẽ hết hiệu lực ngay. Giám khảo phải dùng mã mới cho lần đăng nhập sau. Xác nhận?`,
        confirmText: 'Đổi mã', danger: true,
      }))) return;
    }
    setBusy(true); setErr('');
    try {
      if (modal === 'add') {
        await fetcher('/api/judges', { method: 'POST', body: JSON.stringify({ name: form.name.trim() }) });
      } else if (j) {
        await fetcher('/api/judges/' + j.id, { method: 'PATCH', body: JSON.stringify(form) });
      }
      setModal(null); await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function regen(j: Judge) {
    if (!(await confirm({
      title: 'Đổi mã truy cập',
      message: `Sinh mã mới cho "${j.name}". Mã hiện tại ${j.accessCode} hết hiệu lực ngay. Xác nhận?`,
      confirmText: 'Đổi mã', danger: true,
    }))) return;
    try {
      await fetcher('/api/judges/' + j.id, { method: 'POST', body: JSON.stringify({ action: 'regen' }) });
      await load();
    } catch (e: any) { setErr(e.message); }
  }
  async function unlock(teamId: string, teamName: string) {
    if (!detailOf) return;
    if (!(await confirm({
      title: 'Mở khoá phiếu chấm',
      message: `Mở khoá phiếu của "${detailOf.name}" cho đội "${teamName}". Điểm đã nhập giữ nguyên, `
             + `giám khảo sẽ sửa và nộp lại được. Thao tác này được ghi vào nhật ký.`,
      confirmText: 'Mở khoá', danger: true,
    }))) return;
    setErr('');
    try {
      await fetcher('/api/judges/' + detailOf.id + '/unlock', {
        method: 'POST', body: JSON.stringify({ teamId }),
      });
      setDetail(await fetcher('/api/judges/' + detailOf.id + '/scores'));
    } catch (e: any) { setErr(e.message); }
  }

  async function del(j: Judge) {
    if (!(await confirm({ title: 'Xoá giám khảo', message: `Xoá giám khảo "${j.name}"? Điểm đã chấm của người này sẽ bị xoá.`, confirmText: 'Xoá', danger: true }))) return;
    await fetcher('/api/judges/' + j.id, { method: 'DELETE' }); load();
  }

  const columns: Column<Judge>[] = [
    { key: 'name', header: 'Giám khảo', filterText: (j) => j.name, render: (j) => <b>{j.name}</b> },
    { key: 'code', header: 'Mã truy cập', filterText: (j) => j.accessCode, render: (j) => <span className="code-chip">{j.accessCode}</span> },
    { key: 'act', header: 'Thao tác', align: 'right', render: (j) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <button className="btn btn-sm" onClick={() => openDetail(j)}>Xem điểm</button>{' '}
        <button className="btn btn-sm" onClick={() => openEdit(j)}>Sửa</button>{' '}
        <button className="btn btn-sm" onClick={() => regen(j)}>↻ Đổi mã</button>{' '}
        <button className="btn btn-sm btn-danger" onClick={() => del(j)}>Xoá</button>
      </span>
    ) },
  ];

  return (
    <>
      {err && !modal && (
        <div className="note" style={{ marginBottom: 14 }}><span>!</span><div>{err}</div></div>
      )}

      <DataTable
        columns={columns} rows={judges} getId={(j) => j.id}
        searchPlaceholder="Tìm theo tên hoặc mã…"
        toolbarRight={<button className="btn btn-primary" onClick={openAdd}>＋ Thêm giám khảo</button>}
      />

      {modal && (
        <Modal
          title={modal === 'add' ? 'Thêm giám khảo' : 'Sửa giám khảo'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn" onClick={() => setModal(null)}>Huỷ</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>{modal === 'add' ? 'Thêm' : 'Lưu'}</button>
          </>}
        >
          <div className="field"><label>Tên giám khảo</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>

          {modal !== 'add' && (
            <div className="field">
              <label>Mã truy cập</label>
              <input className="input" value={form.accessCode}
                style={{ fontFamily: 'monospace', letterSpacing: '.08em' }}
                onChange={(e) => setForm({ ...form, accessCode: e.target.value.toUpperCase() })} />
              <div className="hint">4–32 ký tự, chỉ A–Z, 0–9 và dấu gạch ngang. Đổi mã là mã cũ hết hiệu lực ngay.</div>
            </div>
          )}

          {modal === 'add' && <div className="hint">Mã truy cập sẽ tự sinh sau khi tạo.</div>}
          {err && <div className="hint" style={{ marginTop: 10, color: 'var(--red, #c0392b)' }}>{err}</div>}
        </Modal>
      )}

      {detailOf && (
        <Modal
          title={`Phiếu chấm · ${detailOf.name}`}
          maxWidth={860}
          onClose={() => { setDetailOf(null); setDetail(null); }}
          footer={<button className="btn" onClick={() => { setDetailOf(null); setDetail(null); }}>Đóng</button>}
        >
          {!detail ? <div className="loading-box sm"><span className="spin-lg" />Đang tải…</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Đội</th>
                    {detail.criteria.map((c) => (
                      <th key={c.id} style={{ textAlign: 'right', whiteSpace: 'nowrap' }} title={c.name}>
                        {c.name} <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}>/{c.maxScore}</span>
                      </th>
                    ))}
                    <th style={{ textAlign: 'right' }}>Tổng</th>
                    <th style={{ textAlign: 'right' }}>Trạng thái</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.map((r) => (
                    // Bảng đã rộng vì mỗi tiêu chí một cột, nên nhận xét nằm ở
                    // HÀNG PHỤ trải ngang bên dưới thay vì thêm một cột nữa.
                    <Fragment key={r.teamId}>
                    <tr style={r.status === 'none' ? { opacity: .55 } : undefined}>
                      <td><b>{r.teamName}</b> <span className="code-chip">{r.teamCode}</span></td>
                      {detail.criteria.map((c) => (
                        <td key={c.id} className="tnum" style={{ textAlign: 'right' }}>
                          {r.values[c.id] ?? '—'}
                        </td>
                      ))}
                      <td className="tnum" style={{ textAlign: 'right' }}>
                        <b>{r.total === null ? '—' : r.total.toFixed(1)}</b>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={'pill ' + (r.status === 'submitted' ? 'done' : 'pending')}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.status === 'submitted'
                          ? <button className="btn btn-sm" onClick={() => unlock(r.teamId, r.teamName)}>Mở khoá</button>
                          : <span style={{ color: 'var(--muted-2)' }}>—</span>}
                      </td>
                    </tr>
                    {r.comment && (
                      <tr className="cmt-row">
                        <td colSpan={detail.criteria.length + 4}>
                          <div className="cmt-label">Nhận xét</div>
                          <div className="cmt-text">{r.comment}</div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                  {detail.rows.length === 0 && (
                    <tr><td colSpan={detail.criteria.length + 4} style={{ color: 'var(--muted-2)' }}>Chưa có đội nào.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
