'use client';
import { useEffect, useMemo, useState } from 'react';
import { fetcher } from '@/lib/ui';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmProvider';

type Judge = { id: string; name: string; isHead: boolean; accessCode: string };

export default function Judges() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | 'head' | 'normal'>('all');
  const [modal, setModal] = useState<null | 'add' | Judge>(null);
  const [form, setForm] = useState({ name: '', isHead: false });
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function load() { setJudges(await fetcher('/api/judges')); }
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => judges.filter((j) =>
    roleFilter === 'all' ? true : roleFilter === 'head' ? j.isHead : !j.isHead), [judges, roleFilter]);

  function openAdd() { setForm({ name: '', isHead: false }); setModal('add'); }
  function openEdit(j: Judge) { setForm({ name: j.name, isHead: j.isHead }); setModal(j); }

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
        <button className="btn btn-sm" onClick={() => openEdit(j)}>Sửa</button>{' '}
        <button className="btn btn-sm" onClick={() => regen(j.id)}>↻ Đổi mã</button>{' '}
        {!j.isHead && <button className="btn btn-sm btn-danger" onClick={() => del(j)}>Xoá</button>}
      </span>
    ) },
  ];

  return (
    <>
      <p className="page-desc" style={{ marginBottom: 16 }}>Mỗi giám khảo có một mã truy cập cố định. Đúng một Trưởng BGK (lá bài quyết định).</p>

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
    </>
  );
}
