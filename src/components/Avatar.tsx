import React from 'react';

// Team badge: shows the uploaded logo if present, else the code on a colored tile.
export function TeamLogo({
  code, logoUrl, size = 38, color = 'var(--orange)', radius,
}: {
  code: string; logoUrl?: string | null; size?: number; color?: string; radius?: number;
}) {
  const r = (radius ?? Math.round(size * 0.26)) + 'px';
  if (logoUrl) {
    return <img src={logoUrl} alt={code} style={{ width: size, height: size, borderRadius: r, objectFit: 'cover', flex: '0 0 auto', display: 'block' }} />;
  }
  return (
    <span className="team-ava" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), borderRadius: r, background: color }}>{code}</span>
  );
}

// Member avatar: uploaded photo if present, else the first letter of the name.
export function MemberAvatar({
  name, photoUrl, size = 48,
}: {
  name: string; photoUrl?: string | null; size?: number;
}) {
  const r = Math.round(size * 0.26) + 'px';
  if (photoUrl) {
    return <img src={photoUrl} alt={name} style={{ width: size, height: size, borderRadius: r, objectFit: 'cover', flex: '0 0 auto', display: 'block' }} />;
  }
  const initial = name.trim().split(' ').pop()?.[0]?.toUpperCase() || '?';
  return <span className="m-photo" style={{ width: size, height: size, borderRadius: r, fontSize: Math.round(size * 0.34) }}>{initial}</span>;
}
