import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getHeroImage, setHeroImage, getBannerImage, setBannerImage } from '@/lib/services/reveal';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [heroImageUrl, bannerImageUrl] = await Promise.all([getHeroImage(), getBannerImage()]);
  return NextResponse.json({ heroImageUrl, bannerImageUrl });
}

// Accepts either key. Only the keys actually present in the body are written, so
// saving one picker never wipes the other.
export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (u?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const clean = (v: unknown) => (typeof v === 'string' && v ? v : null);
  if ('imageUrl' in body) await setHeroImage(clean(body.imageUrl));
  if ('bannerImageUrl' in body) await setBannerImage(clean(body.bannerImageUrl));
  return NextResponse.json({ ok: true });
}
