import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AgentFactory } from '@/lib/AgentFactory';

export async function POST(request: Request, props: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await props.params;
    
    // Find all HALTED agents in this conversation
    const haltedAgents = await prisma.agentInstance.findMany({
      where: {
        conversationId: conversationId,
        status: 'HALTED'
      }
    });

    if (haltedAgents.length === 0) {
      return NextResponse.json({ success: true, resumedCount: 0 });
    }

    // Update their status back to IDLE
    await prisma.agentInstance.updateMany({
      where: {
        id: { in: haltedAgents.map(a => a.id) }
      },
      data: {
        status: 'IDLE'
      }
    });

    // Notify UI via SSE
    const payload = JSON.stringify({ id: conversationId });

    const bossAgent = haltedAgents.find(a => a.parentInstanceId === null) || haltedAgents[0];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ success: true, resumedCount: haltedAgents.length }) + '\n'));
        
        let isAborted = false;
        const pingInterval = setInterval(() => {
          if (!isAborted) controller.enqueue(encoder.encode(JSON.stringify({ type: 'ping' }) + '\n'));
        }, 10000);

        try {
          await AgentFactory.runReActLoop(bossAgent.id, undefined, undefined, (progress) => {
             if (!isAborted) controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', data: progress }) + '\n'));
          });
        } catch (err) {
          console.error('Background agent loop failed during resume:', err);
          if (!isAborted) controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: String(err) }) + '\n'));
        } finally {
          clearInterval(pingInterval);
          if (!isAborted) controller.close();
        }
      },
      cancel() {
        console.log('Stream cancelled by client');
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    console.error('Error resuming swarm:', error);
    return NextResponse.json({ error: 'Failed to resume swarm' }, { status: 500 });
  }
}
