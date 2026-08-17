import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { getHeroImage, setHeroImage, getBannerImage, setBannerImage } from '@/lib/services/reveal';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [heroImageUrl, bannerImageUrl] = await Promise.all([getHeroImage(), getBannerImage()]);
  return NextResponse.json({ heroImageUrl, bannerImageUrl });
}

// Accepts either key. Only the keys actually present in the body are written, so
// saving one picker never wipes the other.
export async function POST(req: Request) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const clean = (v: unknown) => (typeof v === 'string' && v ? v : null);
  if ('imageUrl' in body) {
    const v = clean(body.imageUrl);
    await setHeroImage(v);
    await audit(u, 'settings.hero_image', { entity: 'settings', detail: v ? 'đặt ảnh' : 'xoá ảnh' });
  }
  if ('bannerImageUrl' in body) {
    const v = clean(body.bannerImageUrl);
    await setBannerImage(v);
    await audit(u, 'settings.banner_image', { entity: 'settings', detail: v ? 'đặt ảnh' : 'xoá ảnh' });
  }
  return NextResponse.json({ ok: true });
}
