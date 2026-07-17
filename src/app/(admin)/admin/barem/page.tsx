'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmProvider';

type Criterion = { id: string; name: string; description?: string | null; maxScore: number };
const EMPTY = { name: '', description: '', maxScore: 10 };

export default function Barem() {
  const [crits, setCrits] = useState<Criterion[]>([]);
  const [modal, setModal] = useState<null | 'add' | Criterion>(null);
  const [form, setForm] = useState<{ name: string; description: string; maxScore: number }>(EMPTY);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function load() { setCrits(await fetcher('/api/criteria')); }
  useEffect(() => { load(); }, []);
  const total = crits.reduce((a, c) => a + c.maxScore, 0);

  function openAdd() { setForm(EMPTY); setModal('add'); }
  function openEdit(c: Criterion) { setForm({ name: c.name, description: c.description || '', maxScore: c.maxScore }); setModal(c); }

  async function save() {
    if (!form.name || !(form.maxScore > 0)) return;
    setBusy(true);
    try {
      const body = { ...form, maxScore: Number(form.maxScore) };
      if (modal === 'add') await fetcher('/api/criteria', { method: 'POST', body: JSON.stringify(body) });
      else if (modal) await fetcher('/api/criteria/' + (modal as Criterion).id, { method: 'PATCH', body: JSON.stringify(body) });
      setModal(null); await load();
    } finally { setBusy(false); }
  }
  async function del(c: Criterion) {
    if (!(await confirm({ title: 'Xoá tiêu chí', message: `Xoá tiêu chí "${c.name}" khỏi barem?`, confirmText: 'Xoá', danger: true }))) return;
    await fetcher('/api/criteria/' + c.id, { method: 'DELETE' }); load();
  }

  return (
    <>
      <div className="page-head">
        <p className="page-desc">Danh sách tiêu chí và điểm tối đa. Tổng điểm tự cộng — không cố định con số.</p>
        <button className="btn btn-primary" onClick={openAdd}>＋ Thêm tiêu chí</button>
      </div>

      <div className="card card-pad">
        {crits.length === 0 && <div className="empty-row">Chưa có tiêu chí nào.</div>}
        {crits.map((c) => (
          <div className="crit" key={c.id}>
            <div><div className="crit-name">{c.name} <span className="crit-max">/ {c.maxScore}đ</span></div><div className="crit-desc">{c.description}</div></div>
            <div className="score-in">
              <button className="btn btn-sm" onClick={() => openEdit(c)}>Sửa</button>
              <button className="btn btn-sm btn-danger" onClick={() => del(c)}>Xoá</button>
            </div>
          </div>
        ))}
        <div className="total-box"><span className="tl">TỔNG ĐIỂM TỐI ĐA</span><span className="tv tnum">{total}<small> điểm</small></span></div>
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Thêm tiêu chí' : 'Sửa tiêu chí'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn" onClick={() => setModal(null)}>Huỷ</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>{modal === 'add' ? 'Thêm' : 'Lưu'}</button>
          </>}
        >
          <div className="field"><label>Tên tiêu chí</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Mô tả</label><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="field"><label>Điểm tối đa</label><input className="input" type="number" step="0.5" min={0} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })} /></div>
        </Modal>
      )}
    </>
  );
}
