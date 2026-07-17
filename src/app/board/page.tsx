'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import Podium from '@/components/Podium';
import Leaderboard from '@/components/Leaderboard';
import Confetti from '@/components/Confetti';

const LoginLink = () => <Link href="/login" className="board-login">Ban tổ chức · Đăng nhập ↗</Link>;

export default function Board() {
  const [data, setData] = useState<any>(null);
  const [celebrate, setCelebrate] = useState(0);
  const prevState = useRef<string | null>(null);

  async function load() {
    const d = await fetcher('/api/results');
    setData(d);
    if (d.state === 'final' && prevState.current !== 'final') setCelebrate((c) => c + 1);
    prevState.current = d.state;
  }
  useEffect(() => {
    load();
    const es = new EventSource('/api/stream');
    es.addEventListener('reveal', load);
    es.addEventListener('update', load);
    return () => es.close();
  }, []);

  // Ongoing fireworks while the final standings are on screen.
  useEffect(() => {
    if (data?.state !== 'final') return;
    const id = setInterval(() => setCelebrate((c) => c + 1), 9000);
    return () => clearInterval(id);
  }, [data?.state]);

  if (!data) return <div className="public-stage board-live"><LoginLink /></div>;

  if (data.state === 'drafting') return (
    <div className="wait-stage">
      <div className="wait-inner">
        <div className="wait-badge">A</div>
        <div className="eyebrow" style={{ textAlign: 'center', color: 'var(--cyan)' }}>Automotive Hackathon 2026 · Chung kết</div>
        <h1 className="wait-title">Kết quả sắp được <span>công bố</span></h1>
        <p className="wait-desc">Ban giám khảo đang hoàn tất chấm điểm.</p>
        <div className="dots-live"><i></i> ĐANG CHỜ TÍN HIỆU CÔNG BỐ</div>
      </div>
      <LoginLink />
    </div>
  );

  const phase = data.state;
  return (
    <div className={'public-stage board-live' + (phase === 'final' ? ' board-final' : '')}>
      {phase === 'final' && <Confetti fire={celebrate} />}
      <div className="pub-head">
        <div>
          <div className="eyebrow" style={{ color: 'var(--cyan)' }}>Vòng chung kết · Bảng xếp hạng trực tiếp</div>
          <div className="pub-title">Automotive <span>Hackathon</span> 2026</div>
        </div>
        <span className="pill live" style={{ fontSize: 13, padding: '8px 16px' }}>{phase === 'final' ? '● CHUNG CUỘC' : '● ĐIỂM TẠM · LIVE'}</span>
      </div>
      {phase === 'provisional' && (
        <div className="prov-banner"><span className="pb-ic">⏳</span>
          <div><b>ĐIỂM TẠM — chưa có điểm Trưởng Ban giám khảo</b><p>Bảng cập nhật realtime theo từng giám khảo.</p></div>
          <span className="prov-tag">4/5 GIÁM KHẢO</span></div>
      )}
      {phase === 'final' && <Podium rows={data.rows} baremTotal={data.baremTotal} />}
      <Leaderboard rows={data.rows} phase={phase} baremTotal={data.baremTotal} />
      <LoginLink />
    </div>
  );
}
