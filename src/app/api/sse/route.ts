import { NextRequest, NextResponse } from 'next/server';
import { sseBus } from '@/lib/sseBus';
import { validateConversationAccess } from '@/lib/withSession';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  const access = await validateConversationAccess(conversationId);
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    async start(controller) {
      let isAborted = req.signal.aborted;
      let pingInterval: NodeJS.Timeout | null = null;
      let pollInterval: NodeJS.Timeout | null = null;
      let unsubscribe: (() => void) | null = null;

      const cleanup = () => {
        isAborted = true;
        if (pingInterval) clearInterval(pingInterval);
        if (pollInterval) clearInterval(pollInterval);
        if (unsubscribe) unsubscribe();
      };

      req.signal.addEventListener('abort', cleanup);
      if (isAborted) return;

      try {
        // Fast-path in-memory local dev updates
        unsubscribe = sseBus.subscribe(conversationId, (event) => {
          if (!isAborted) {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        });

        // Cloud Run database polling for horizontal scaling
        let lastMsgTime = new Date();
        let seenMsgIds = new Set<string>();
        
        let lastAgentTime = new Date();
        let seenAgentIds = new Set<string>();
        
        const { prisma } = await import('@/lib/db');

        pollInterval = setInterval(async () => {
          if (isAborted) return;
          try {
            const newMsgs = await prisma.message.findMany({
              where: { channel: { conversationId }, createdAt: { gte: lastMsgTime } },
              orderBy: { createdAt: 'desc' },
              take: 50
            });
            
            const unseenMsgs = newMsgs.filter(m => !seenMsgIds.has(m.id));
            if (unseenMsgs.length > 0 && !isAborted) {
              const maxTime = new Date(Math.max(...unseenMsgs.map(m => m.createdAt.getTime())));
              if (maxTime > lastMsgTime) {
                lastMsgTime = maxTime;
                seenMsgIds.clear();
              }
              unseenMsgs.filter(m => m.createdAt.getTime() === lastMsgTime.getTime()).forEach(m => seenMsgIds.add(m.id));
              
              const data = JSON.stringify({ type: 'message_update', data: { channelId: unseenMsgs[0].channelId } });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            const updatedAgents = await prisma.agentInstance.findMany({
              where: { conversationId, updatedAt: { gte: lastAgentTime } },
              orderBy: { updatedAt: 'desc' },
              take: 50
            });
            
            const unseenAgents = updatedAgents.filter(a => !seenAgentIds.has(a.id));
            if (unseenAgents.length > 0 && !isAborted) {
              const maxTime = new Date(Math.max(...unseenAgents.map(a => a.updatedAt.getTime())));
              if (maxTime > lastAgentTime) {
                lastAgentTime = maxTime;
                seenAgentIds.clear();
              }
              unseenAgents.filter(a => a.updatedAt.getTime() === lastAgentTime.getTime()).forEach(a => seenAgentIds.add(a.id));

              const data = JSON.stringify({ type: 'agent_update', data: { id: conversationId, status: unseenAgents[0].status, agentInstanceId: unseenAgents[0].id } });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          } catch (e) {
            console.error('SSE DB Polling Error:', e);
          }
        }, 3000);

        pingInterval = setInterval(() => {
          if (!isAborted) {
            controller.enqueue(encoder.encode(': ping\n\n'));
          }
        }, 15000); // 15s to keep Cloud Run alive
      } catch (err: unknown) {
        console.error('SSE connection error:', err instanceof Error ? err.message : String(err));
        controller.error(err);
      }
    },
  });

  return new NextResponse(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
