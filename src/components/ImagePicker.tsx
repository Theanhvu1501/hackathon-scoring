'use client';
import { useRef, useState } from 'react';

function resizeToDataUrl(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ImagePicker({
  value, onChange, shape = 'square', size = 64, max = 256, placeholder = '＋',
}: {
  value?: string | null;
  onChange: (v: string) => void;
  shape?: 'square' | 'circle';
  size?: number;
  max?: number;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const radius = shape === 'circle' ? '50%' : Math.round(size * 0.24) + 'px';

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onChange(await resizeToDataUrl(file, max)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="img-preview" style={{ width: size, height: size, borderRadius: radius }}>
        {value ? <img src={value} alt="" /> : <span>{placeholder}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Đang xử lý…' : value ? 'Đổi ảnh' : 'Tải ảnh lên'}
        </button>
        {value && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange('')}>Xoá ảnh</button>}
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
      </div>
    </div>
  );
}
