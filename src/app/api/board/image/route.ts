import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { getBannerImage, setBannerImage } from '@/lib/services/reveal';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ bannerImageUrl: await getBannerImage() });
}

export async function POST(req: Request) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  if (!('bannerImageUrl' in body)) {
    return NextResponse.json({ error: 'bannerImageUrl required' }, { status: 400 });
  }
  const v = typeof body.bannerImageUrl === 'string' && body.bannerImageUrl ? body.bannerImageUrl : null;
  await setBannerImage(v);
  await audit(u, 'settings.banner_image', { entity: 'settings', detail: v ? 'đặt ảnh' : 'xoá ảnh' });
  return NextResponse.json({ ok: true });
}
