import { NextResponse } from 'next/server';
import { Overseer } from '@/lib/Overseer';

export async function GET(request: Request) {
  try {
    await Overseer.checkSwarmHealth();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Overseer Cron Error:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}