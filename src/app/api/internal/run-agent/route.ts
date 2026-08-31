import { NextResponse, NextRequest } from 'next/server';
import { after } from 'next/server';
import { AgentFactory } from '@/lib/AgentFactory';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!process.env.INTERNAL_API_KEY || authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { agentId, prompt, channelId } = await request.json();
    
    after(() => {
      AgentFactory.runReActLoop(agentId, prompt, undefined, () => {}, channelId).catch(console.error);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to run background agent:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
