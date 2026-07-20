'use client';
import { useEffect, useRef } from 'react';

// Light trails, the event site's signature motif: long luminous streaks
// sweeping across the page. Kept low-contrast so the standings stay readable.
const TRAIL_COLORS = ['#0047FF', '#00A3FF', '#F97322', '#FF954B', '#4248C1'];

export default function AmbientNet() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, raf = 0;
    type Trail = {
      y: number; amp: number; phase: number; speed: number;
      width: number; color: string; alpha: number;
    };
    let trails: Trail[] = [];

    function build() {
      W = window.innerWidth; H = window.innerHeight;
      canvas!.width = W * DPR; canvas!.height = H * DPR;
      canvas!.style.width = W + 'px'; canvas!.style.height = H + 'px';
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      trails = Array.from({ length: 16 }, (_, i) => {
        // Cluster them near the top and bottom edges, away from the standings.
        const edge = i % 2 === 0 ? Math.random() * 0.34 : 0.66 + Math.random() * 0.34;
        return {
          y: edge * H,
          amp: 22 + Math.random() * 90,
          phase: Math.random() * Math.PI * 2,
          speed: 0.0016 + Math.random() * 0.0032,
          width: 1 + Math.random() * 2.6,
          color: TRAIL_COLORS[i % TRAIL_COLORS.length],
          alpha: 0.10 + Math.random() * 0.16,
        };
      });
    }
    build();

    function draw(t: number) {
      ctx!.clearRect(0, 0, W, H);
      ctx!.lineCap = 'round';
      for (const s of trails) {
        ctx!.beginPath();
        for (let x = -40; x <= W + 40; x += 14) {
          const y = s.y
            + Math.sin(x * 0.0022 + s.phase + t * s.speed) * s.amp
            + Math.sin(x * 0.0007 - s.phase) * s.amp * 0.4;
          if (x === -40) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = s.color;
        ctx!.globalAlpha = s.alpha;
        ctx!.lineWidth = s.width;
        ctx!.shadowColor = s.color;
        ctx!.shadowBlur = 18;
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
      ctx!.shadowBlur = 0;
      if (!reduce) raf = requestAnimationFrame(draw);
    }
    draw(0);

    const onResize = () => build();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return <canvas ref={ref} className="pw-ambient" aria-hidden />;
}
