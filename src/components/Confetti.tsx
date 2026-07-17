'use client';
import { useEffect, useRef } from 'react';

type P = { x: number; y: number; vx: number; vy: number; g: number; size: number; color: string; rot: number; vr: number; life: number; ttl: number };

const COLORS = ['#f37021', '#ff9730', '#2563eb', '#00d4ff', '#ffd15c', '#3ecf6a', '#e23b3b', '#a855f7'];

// Fires a fireworks/confetti burst every time `fire` changes to a new truthy value.
export default function Confetti({ fire }: { fire: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partsRef = useRef<P[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!fire) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const W = canvas.width, H = canvas.height;

    const burst = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * 8;
        partsRef.current.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
          g: 0.12 + Math.random() * 0.09, size: 5 + Math.random() * 8,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35, life: 0, ttl: 110 + Math.random() * 70,
        });
      }
    };

    const timers: number[] = [];
    burst(W * 0.5, H * 0.34, 150);
    timers.push(window.setTimeout(() => burst(W * 0.24, H * 0.3, 100), 220));
    timers.push(window.setTimeout(() => burst(W * 0.76, H * 0.3, 100), 420));
    timers.push(window.setTimeout(() => burst(W * 0.5, H * 0.22, 120), 640));

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const parts = partsRef.current;
      for (const p of parts) {
        p.life++; p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.ttl);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      partsRef.current = parts.filter((p) => p.life < p.ttl && p.y < H + 40);
      if (partsRef.current.length > 0) rafRef.current = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    cancelAnimationFrame(rafRef.current);
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      timers.forEach(clearTimeout);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [fire]);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 60 }} aria-hidden />;
}
