import { NextResponse } from 'next/server';
import { Overseer } from '@/lib/Overseer';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'Cron secret not configured on server' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}` && request.headers.get('x-cron-secret') !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
    }

    await Overseer.checkSwarmHealth();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Overseer Cron Error:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}