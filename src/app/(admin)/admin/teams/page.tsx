'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';

type Team = { id: string; name: string; code: string; tag?: string | null; members?: any[] };
const EMPTY = { name: '', code: '', tag: '' };

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [modal, setModal] = useState<null | 'add' | Team>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function load() { setTeams(await fetcher('/api/teams')); }
  useEffect(() => { load(); }, []);

  function openAdd() { setForm(EMPTY); setModal('add'); }
  function openEdit(t: Team) { setForm({ name: t.name, code: t.code, tag: t.tag || '' }); setModal(t); }

  async function save() {
    if (!form.name || !form.code) return;
    setBusy(true);
    try {
      if (modal === 'add') await fetcher('/api/teams', { method: 'POST', body: JSON.stringify(form) });
      else if (modal) await fetcher('/api/teams/' + (modal as Team).id, { method: 'PATCH', body: JSON.stringify(form) });
      setModal(null); await load();
    } finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm('Xoá đội này? Toàn bộ thành viên và điểm sẽ bị xoá.')) return;
    await fetcher('/api/teams/' + id, { method: 'DELETE' }); load();
  }

  const columns: Column<Team>[] = [
    { key: 'team', header: 'Đội', filterText: (t) => t.name + ' ' + t.code, render: (t) => (
      <div className="tcell"><span className="team-ava" style={{ background: 'var(--orange)' }}>{t.code}</span><b>{t.name}</b></div>
    ) },
    { key: 'members', header: 'Thành viên', render: (t) => <span className="tnum">{t.members?.length || 0} người</span> },
    { key: 'tag', header: 'Mô tả', filterText: (t) => t.tag || '', render: (t) => <span style={{ color: 'var(--muted)' }}>{t.tag}</span> },
    { key: 'act', header: 'Thao tác', align: 'right', render: (t) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <Link className="btn btn-sm" href={'/admin/teams/' + t.id}>Chi tiết</Link>{' '}
        <button className="btn btn-sm" onClick={() => openEdit(t)}>Sửa</button>{' '}
        <button className="btn btn-sm btn-danger" onClick={() => del(t.id)}>Xoá</button>
      </span>
    ) },
  ];

  return (
    <>
      <div className="page-head"><div><div className="eyebrow">Admin CMS</div><div className="page-title">Quản lý đội thi</div>
        <div className="page-desc">Tạo đội, quản lý thành viên. Bấm "Chi tiết" để xem/sửa thành viên.</div></div></div>

      <DataTable
        columns={columns} rows={teams} getId={(t) => t.id}
        searchPlaceholder="Tìm theo tên hoặc mã đội…"
        toolbarRight={<button className="btn btn-primary" onClick={openAdd}>＋ Thêm đội</button>}
      />

      {modal && (
        <Modal
          title={modal === 'add' ? 'Thêm đội thi' : 'Sửa đội thi'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn" onClick={() => setModal(null)}>Huỷ</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>{modal === 'add' ? 'Thêm' : 'Lưu'}</button>
          </>}
        >
          <div className="two-col">
            <div className="field"><label>Tên đội</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Mã (badge, 2–3 ký tự)</label><input className="input" value={form.code} maxLength={3} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
          </div>
          <div className="field"><label>Mô tả ngắn</label><textarea className="textarea" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></div>
        </Modal>
      )}
    </>
  );
}
