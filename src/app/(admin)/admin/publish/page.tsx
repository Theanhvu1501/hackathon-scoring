'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import ImagePicker from '@/components/ImagePicker';

const STEPS = [{ k: 'drafting', n: '1', t: 'Đang chấm' }, { k: 'provisional', n: '2', t: 'Điểm tạm' }, { k: 'final', n: '3', t: 'Chung cuộc' }];

export default function Publish() {
  const [state, setState] = useState('drafting');
  const [hero, setHero] = useState<string>('');

  async function load() {
    const [rev, img] = await Promise.all([fetcher('/api/reveal'), fetcher('/api/board/image')]);
    setState(rev.state);
    setHero(img.heroImageUrl || '');
  }
  useEffect(() => { load(); }, []);

  async function set(s: string) { await fetcher('/api/reveal', { method: 'POST', body: JSON.stringify({ state: s }) }); setState(s); }
  async function saveHero(v: string) {
    setHero(v);
    await fetcher('/api/board/image', { method: 'POST', body: JSON.stringify({ imageUrl: v || null }) });
  }
  const idx = STEPS.findIndex((s) => s.k === state);

  return (
    <>
      <div className="stepper">{STEPS.map((s, i) => (
        <div key={s.k} className={'step ' + (i === idx ? 'active' : '') + (i < idx ? ' done' : '')}>
          <div className="step-n">{i < idx ? '✓' : s.n}</div><h4>{s.t}</h4>
        </div>
      ))}</div>

      <div className="two-col" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start', marginTop: 20 }}>
        <div className="card card-pad">
          {state === 'drafting' && <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={() => set('provisional')}>▶ Mở bảng điểm tạm (realtime)</button>}
          {state === 'provisional' && <>
            <div className="note" style={{ marginBottom: 16 }}><span>◉</span><div><b style={{ color: 'var(--text)' }}>Đang chiếu điểm tạm.</b> Điểm Trưởng BGK đang giữ kín.</div></div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 15 }} onClick={() => set('final')}>♛ LỘ ĐIỂM TRƯỞNG BGK &amp; CHỐT KẾT QUẢ</button>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={() => set('drafting')}>← Quay lui về màn chờ</button>
          </>}
          {state === 'final' && <>
            <div className="note" style={{ marginBottom: 16 }}><span style={{ color: 'var(--green)' }}>✓</span><div><b style={{ color: 'var(--text)' }}>Đã công bố chung cuộc.</b></div></div>
            <a className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} href="/board" target="_blank">Xem bảng công khai →</a>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={() => set('provisional')}>← Quay lui (mở lại để sửa)</button>
          </>}
        </div>

        <div className="card card-pad">
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Ảnh nền màn chiếu</h3>
          <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>Ảnh hiển thị ở panel bên trái của trang board (nên là ảnh dọc/chân dung, độ phân giải tốt).</p>
          <ImagePicker value={hero} onChange={saveHero} size={120} max={900} placeholder="＋ Ảnh" />
        </div>
      </div>
    </>
  );
}
