'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import Modal from '@/components/Modal';

type Member = { id: string; name: string; teamRole?: string | null; org?: string | null; email?: string | null; phone?: string | null; intro?: string | null };
type Team = { id: string; name: string; code: string; tag?: string | null; members: Member[] };
const EMPTY = { name: '', teamRole: '', org: '', email: '', phone: '', intro: '' };

export default function TeamDetail({ params }: { params: { id: string } }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [modal, setModal] = useState<null | 'add' | Member>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function load() {
    const all: Team[] = await fetcher('/api/teams');
    setTeam(all.find((t) => t.id === params.id) || null);
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setForm(EMPTY); setModal('add'); }
  function openEdit(m: Member) {
    setForm({ name: m.name, teamRole: m.teamRole || '', org: m.org || '', email: m.email || '', phone: m.phone || '', intro: m.intro || '' });
    setModal(m);
  }
  async function save() {
    if (!form.name) return;
    setBusy(true);
    try {
      if (modal === 'add') await fetcher('/api/members', { method: 'POST', body: JSON.stringify({ teamId: params.id, ...form }) });
      else if (modal) await fetcher('/api/members/' + (modal as Member).id, { method: 'PATCH', body: JSON.stringify(form) });
      setModal(null); await load();
    } finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm('Xoá thành viên này?')) return;
    await fetcher('/api/members/' + id, { method: 'DELETE' }); load();
  }

  if (!team) return <div className="card card-pad">Đang tải…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="btn btn-ghost btn-sm" href="/admin/teams" style={{ marginBottom: 10 }}>← Danh sách đội</Link>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="team-ava" style={{ width: 46, height: 46, fontSize: 18, background: 'var(--orange)' }}>{team.code}</span>
            {team.name}
          </div>
          <div className="page-desc">{team.tag}</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>＋ Thêm thành viên</button>
      </div>

      <h3 style={{ marginBottom: 14, color: 'var(--muted)', fontSize: 15 }}>Thành viên ({team.members.length})</h3>
      {team.members.length === 0 && <div className="card card-pad" style={{ color: 'var(--muted-2)' }}>Chưa có thành viên. Bấm "Thêm thành viên".</div>}
      <div className="members">
        {team.members.map((m) => (
          <div className="card member" key={m.id}>
            <div className="m-top">
              <span className="m-photo">{m.name.split(' ').pop()![0]}</span>
              <div><div className="m-name">{m.name}</div><div className="m-role">{m.teamRole}</div></div>
            </div>
            <div className="m-meta">{m.org}{m.email ? <><br />✉ {m.email}</> : null}{m.phone ? <><br />☎ {m.phone}</> : null}</div>
            {m.intro && <div className="m-intro">{m.intro}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEdit(m)}>Sửa</button>
              <button className="btn btn-sm btn-danger" onClick={() => del(m.id)}>Xoá</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Thêm thành viên' : 'Sửa thành viên'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn" onClick={() => setModal(null)}>Huỷ</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>{modal === 'add' ? 'Thêm' : 'Lưu'}</button>
          </>}
        >
          <div className="two-col">
            <div className="field"><label>Họ tên</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Vai trò trong đội</label><input className="input" value={form.teamRole} onChange={(e) => setForm({ ...form, teamRole: e.target.value })} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Đơn vị / Trường</label><input className="input" value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} /></div>
            <div className="field"><label>Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="field"><label>Số điện thoại</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="field"><label>Giới thiệu</label><textarea className="textarea" value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} /></div>
        </Modal>
      )}
    </>
  );
}
