import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getHeroImage, setHeroImage } from '@/lib/services/reveal';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ heroImageUrl: await getHeroImage() });
}

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (u?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { imageUrl } = await req.json();
  await setHeroImage(typeof imageUrl === 'string' && imageUrl ? imageUrl : null);
  return NextResponse.json({ ok: true });
}
