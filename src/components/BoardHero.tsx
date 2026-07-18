'use client';
import { useEffect, useRef } from 'react';

// Animated "AI neural constellation" + racing car silhouette hero panel,
// styled in the FPT Automotive Hackathon palette (navy / orange / cyan).
export default function BoardHero({ phase, imageUrl }: { phase: string; imageUrl?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, raf = 0;
    let nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    const colors = ['#ff9730', '#f37021', '#00d4ff', '#5fb3ff'];

    function resize() {
      const r = parent!.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas!.width = W * DPR; canvas!.height = H * DPR;
      canvas!.style.width = W + 'px'; canvas!.style.height = H + 'px';
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.max(26, Math.min(64, Math.round((W * H) / 15000)));
      nodes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.32, vy: (Math.random() - 0.5) * 0.32 }));
    }
    resize();

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 132) {
            ctx!.strokeStyle = `rgba(0,190,240,${(1 - d / 132) * 0.3})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(b.x, b.y); ctx!.stroke();
          }
        }
      }
      nodes.forEach((n, i) => {
        ctx!.fillStyle = colors[i % colors.length];
        ctx!.beginPath(); ctx!.arc(n.x, n.y, 2.3, 0, Math.PI * 2); ctx!.fill();
        if (!reduce) { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > W) n.vx *= -1; if (n.y < 0 || n.y > H) n.vy *= -1; }
      });
      if (!reduce) raf = requestAnimationFrame(draw);
    }
    draw();

    const onR = () => resize();
    window.addEventListener('resize', onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onR); };
  }, []);

  return (
    <div className={'board-hero' + (imageUrl ? ' has-photo' : '')}>
      {imageUrl && <div className="hero-photo" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden />}
      {imageUrl && <div className="hero-photo-overlay" aria-hidden />}
      <canvas ref={canvasRef} className="hero-canvas" aria-hidden />
      <div className="hero-grid" aria-hidden />
      <div className="hero-live"><span className="pill live">{phase === 'final' ? '● CHUNG CUỘC' : '● TRỰC TIẾP'}</span></div>

      <div className="hero-content">
        <div className="hero-badge">A</div>
        <div className="hero-kicker">FPT Software · FPT Corporation</div>
        <h1 className="hero-title">AUTOMOTIVE<br /><span>HACKATHON</span> 2026</h1>
        <div className="hero-sub">Vòng Chung Kết · Công nghệ AI cho ngành ô tô</div>
        <div className="hero-tags"><span>AI</span><span>Autonomous</span><span>Mobility</span><span>Realtime</span></div>
      </div>

      <svg className="hero-car" viewBox="0 0 720 210" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="carGrad" x1="0" y1="0" x2="720" y2="0">
            <stop stopColor="#f37021" /><stop offset="0.55" stopColor="#ff9730" /><stop offset="1" stopColor="#00d4ff" />
          </linearGradient>
        </defs>
        <path d="M34 150 C110 150 150 120 214 110 C280 100 316 82 380 86 C452 90 520 104 574 126 C620 144 664 148 690 158 C700 162 700 168 690 170 L520 170 A40 40 0 0 0 440 170 L252 170 A40 40 0 0 0 172 170 L38 170 C28 170 26 152 34 150 Z"
          fill="url(#carGrad)" opacity="0.92" />
        <circle cx="212" cy="170" r="30" fill="#06183a" /><circle cx="212" cy="170" r="13" fill="#00d4ff" opacity="0.85" />
        <circle cx="480" cy="170" r="30" fill="#06183a" /><circle cx="480" cy="170" r="13" fill="#ff9730" opacity="0.9" />
      </svg>
    </div>
  );
}
