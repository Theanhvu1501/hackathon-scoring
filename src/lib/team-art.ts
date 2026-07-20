// Procedural artwork for teams. Everything here is deterministic from the team
// code, so a team looks identical on every screen and across reloads — and it
// works with no image assets and no network. Uploaded images always win over
// these; see the components for the fallback order.

// Pulled from the event brand: electric blue, cyan, FPT orange, indigo, green.
const HUES = [222, 199, 24, 240, 142];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const svgUrl = (svg: string) =>
  'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());

/** Stable accent hue for a team — drives its mark, visual and row accents. */
export function teamHue(code: string): number {
  return HUES[hash(code) % HUES.length];
}

/**
 * Team mark: a 4×4 weight kernel. Cell intensities come from the team's seed,
 * so every team gets a different pattern that still reads as one family.
 * Legible down to ~28px, which is the size it runs at in the tower.
 */
export function teamMark(code: string): string {
  const hue = teamHue(code);
  const r = rng(hash(code + ':mark'));
  const cells: string[] = [];
  const step = 22, pad = 6;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const v = r();
      const a = (0.18 + v * 0.82).toFixed(2);
      const l = 52 + v * 30;
      cells.push(
        `<rect x="${pad + x * step}" y="${pad + y * step}" width="16" height="16" rx="2.5"
           fill="hsl(${hue} 88% ${l}%)" opacity="${a}"/>`,
      );
    }
  }
  return svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 62% 20%)"/>
          <stop offset="1" stop-color="hsl(${hue} 72% 11%)"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#b)"/>
      ${cells.join('')}
    </svg>`);
}

/**
 * Project visual for the leader band: an attention field — a coarse activation
 * grid under a scatter of nodes and their links. Abstract on purpose; it stands
 * in for the team's work until someone uploads a real screenshot.
 */
export function projectVisual(code: string): string {
  const hue = teamHue(code);
  const alt = HUES[(HUES.indexOf(hue) + 2) % HUES.length];
  const r = rng(hash(code + ':viz'));
  const W = 640, H = 400;

  // Activation field: noise alone reads as static, so the intensity is pulled
  // toward one focal blob. That gives the map a subject and a falloff.
  const cols = 14, rows = 9, cw = W / cols, ch = H / rows;
  const fx = 3 + r() * (cols - 6), fy = 2 + r() * (rows - 4);
  const grid: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dist = Math.hypot((x - fx) / cols, (y - fy) / rows) * 2.4;
      const focus = Math.max(0, 1 - dist * dist);
      const v = Math.min(1, focus * 0.85 + r() * 0.34);
      if (v < 0.16) continue;
      grid.push(
        `<rect x="${(x * cw + 1.5).toFixed(1)}" y="${(y * ch + 1.5).toFixed(1)}"
           width="${(cw - 3).toFixed(1)}" height="${(ch - 3).toFixed(1)}" rx="1.5"
           fill="hsl(${hue} ${58 + v * 30}% ${34 + v * 42}%)" opacity="${(v * 0.94).toFixed(2)}"/>`,
      );
    }
  }

  const nodes = Array.from({ length: 14 }, () => ({
    x: 40 + r() * (W - 80), y: 40 + r() * (H - 80), s: 2 + r() * 4,
  }));
  const links: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d > 150) continue;
      links.push(
        `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}"
           x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}"
           stroke="hsl(${alt} 90% 70%)" stroke-width="1" opacity="${(0.32 * (1 - d / 150)).toFixed(2)}"/>`,
      );
    }
  }
  const dots = nodes.map((n) =>
    `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.s.toFixed(1)}"
       fill="hsl(${alt} 95% 72%)" opacity="0.9"/>`).join('');

  return svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
      <defs>
        <radialGradient id="g" cx="${(fx / cols).toFixed(2)}" cy="${(fy / rows).toFixed(2)}" r="0.85">
          <stop offset="0" stop-color="hsl(${hue} 64% 21%)"/>
          <stop offset="1" stop-color="#061838"/>
        </radialGradient>
        <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#061838" stop-opacity="0.45"/>
          <stop offset="0.45" stop-color="#061838" stop-opacity="0"/>
          <stop offset="1" stop-color="#061838" stop-opacity="0.7"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      ${grid.join('')}
      ${links.join('')}
      ${dots}
      <rect width="${W}" height="${H}" fill="url(#v)"/>
    </svg>`);
}

/** Deterministic two-tone gradient for a member avatar with no photo. */
export function memberGradient(name: string): string {
  const h = hash(name);
  const a = HUES[h % HUES.length];
  // >>> not >>: hash is a uint32, and a signed shift makes it negative for
  // half of all names, which indexes past the array and voids the gradient.
  const b = HUES[(h >>> 3) % HUES.length];
  return `linear-gradient(135deg, hsl(${a} 70% 46%), hsl(${b} 65% 32%))`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}
