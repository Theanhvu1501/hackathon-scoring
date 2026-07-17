import { NextResponse } from 'next/server';
import { getResults } from '@/lib/services/reveal';
export async function GET() { return NextResponse.json(await getResults()); }
