'use client';
import { useEffect, useMemo, useState } from 'react';
import { fetcher } from '@/lib/ui';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmProvider';

type Judge = { id: string; name: string; isHead: boolean; accessCode: string };
type Criterion = { id: string; name: string; maxScore: number; order: number };
type DetailRow = {
  teamId: string; teamName: string; teamCode: string;
  values: Record<string, number>; total: number | null;
  status: 'submitted' | 'draft' | 'none';
};
type Detail = { criteria: Criterion[]; rows: DetailRow[] };

const STATUS_LABEL: Record<DetailRow['status'], string> = {
  submitted: 'Đã nộp', draft: 'Nháp', none: 'Chưa chấm',
};

export default function Judges() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | 'head' | 'normal'>('all');
  const [modal, setModal] = useState<null | 'add' | Judge>(null);
  const [form, setForm] = useState({ name: '', isHead: false });
  const [busy, setBusy] = useState(false);
  const [detailOf, setDetailOf] = useState<Judge | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const confirm = useConfirm();

  async function load() { setJudges(await fetcher('/api/judges')); }
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => judges.filter((j) =>
    roleFilter === 'all' ? true : roleFilter === 'head' ? j.isHead : !j.isHead), [judges, roleFilter]);

  function openAdd() { setForm({ name: '', isHead: false }); setModal('add'); }
  function openEdit(j: Judge) { setForm({ name: j.name, isHead: j.isHead }); setModal(j); }
  async function openDetail(j: Judge) {
    setDetailOf(j); setDetail(null);
    setDetail(await fetcher('/api/judges/' + j.id + '/scores'));
  }

  async function save() {
    if (!form.name) return;
    setBusy(true);
    try {
      if (modal === 'add') await fetcher('/api/judges', { method: 'POST', body: JSON.stringify(form) });
      else if (modal) await fetcher('/api/judges/' + (modal as Judge).id, { method: 'PATCH', body: JSON.stringify(form) });
      setModal(null); await load();
    } finally { setBusy(false); }
  }
  async function regen(id: string) { await fetcher('/api/judges/' + id, { method: 'POST', body: JSON.stringify({ action: 'regen' }) }); load(); }
  async function del(j: Judge) {
    if (!(await confirm({ title: 'Xoá giám khảo', message: `Xoá giám khảo "${j.name}"? Điểm đã chấm của người này sẽ bị xoá.`, confirmText: 'Xoá', danger: true }))) return;
    await fetcher('/api/judges/' + j.id, { method: 'DELETE' }); load();
  }

  const columns: Column<Judge>[] = [
    { key: 'name', header: 'Giám khảo', filterText: (j) => j.name, render: (j) => (
      <span><b>{j.name}</b> {j.isHead && <span className="badge-head">♛ Trưởng BGK</span>}</span>
    ) },
    { key: 'code', header: 'Mã truy cập', filterText: (j) => j.accessCode, render: (j) => <span className="code-chip">{j.accessCode}</span> },
    { key: 'act', header: 'Thao tác', align: 'right', render: (j) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <button className="btn btn-sm" onClick={() => openDetail(j)}>Xem điểm</button>{' '}
        <button className="btn btn-sm" onClick={() => openEdit(j)}>Sửa</button>{' '}
        <button className="btn btn-sm" onClick={() => regen(j.id)}>↻ Đổi mã</button>{' '}
        {!j.isHead && <button className="btn btn-sm btn-danger" onClick={() => del(j)}>Xoá</button>}
      </span>
    ) },
  ];

  return (
    <>
      <DataTable
        columns={columns} rows={shown} getId={(j) => j.id}
        searchPlaceholder="Tìm theo tên hoặc mã…"
        filters={
          <select className="filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
            <option value="all">Tất cả vai trò</option>
            <option value="head">Trưởng BGK</option>
            <option value="normal">Giám khảo thường</option>
          </select>
        }
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
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: 'var(--text)' }}>
            <input type="checkbox" checked={form.isHead} onChange={(e) => setForm({ ...form, isHead: e.target.checked })} />
            Đặt làm <b>Trưởng BGK</b> (lá bài quyết định — chỉ một người)
          </label>
          {modal === 'add' && <div className="hint" style={{ marginTop: 10 }}>Mã truy cập sẽ tự sinh sau khi tạo.</div>}
        </Modal>
      )}

      {detailOf && (
        <Modal
          title={`Phiếu chấm · ${detailOf.name}`}
          maxWidth={860}
          onClose={() => { setDetailOf(null); setDetail(null); }}
          footer={<button className="btn" onClick={() => { setDetailOf(null); setDetail(null); }}>Đóng</button>}
        >
          {!detail ? <div style={{ color: 'var(--muted-2)' }}>Đang tải…</div> : (
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
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.map((r) => (
                    <tr key={r.teamId} style={r.status === 'none' ? { opacity: .55 } : undefined}>
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
                    </tr>
                  ))}
                  {detail.rows.length === 0 && (
                    <tr><td colSpan={detail.criteria.length + 3} style={{ color: 'var(--muted-2)' }}>Chưa có đội nào.</td></tr>
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
