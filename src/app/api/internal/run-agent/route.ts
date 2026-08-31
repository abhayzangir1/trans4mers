import { NextResponse, NextRequest } from 'next/server';
import { AgentFactory } from '@/lib/AgentFactory';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!process.env.INTERNAL_API_KEY || authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { agentId, prompt, channelId } = await request.json();
    
    // We intentionally DO NOT await this here so the internal endpoint can return quickly? 
    // Wait, if it's an internal endpoint, it can just wait. Next.js limits serverless execution time to 15s or 60s, but on local Node.js it's infinite.
    // If it waits, the HTTP socket stays open until it finishes. That's fine! 
    // The calling function `triggerBackgroundAgent` doesn't await the response, it just writes and ends the request.
    await AgentFactory.runReActLoop(agentId, prompt, undefined, () => {}, channelId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to run background agent:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
