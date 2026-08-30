import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    async start(controller) {
      let intervalId: NodeJS.Timeout | null = null;
      let isAborted = req.signal.aborted;
      let lastChecked = new Date();

      req.signal.addEventListener('abort', () => {
        isAborted = true;
        if (intervalId) clearInterval(intervalId);
      });

      if (isAborted) return;

      try {
        intervalId = setInterval(async () => {
          if (isAborted) {
             clearInterval(intervalId!);
             return;
          }

          try {
            const now = new Date();
            // Check for agent updates
            const agentUpdates = await prisma.agentInstance.findMany({
              where: { updatedAt: { gt: lastChecked } },
              select: { id: true, status: true, conversationId: true }
            });

            // Check for chat updates
            const chatUpdates = await prisma.message.findMany({
              where: { createdAt: { gt: lastChecked } },
              select: { id: true, channel: { select: { conversationId: true } } },
              distinct: ['channelId'] // Only need one update per conversation
            });

            lastChecked = now;

            for (const agent of agentUpdates) {
              const payloadWithChannel = JSON.stringify({
                channel: 'agent_updates',
                payload: { id: agent.conversationId, status: agent.status, agentInstanceId: agent.id }
              });
              if (!isAborted) controller.enqueue(encoder.encode(`data: ${payloadWithChannel}\n\n`));
            }

            // Deduplicate conversation IDs for chat updates
            const chatConversations = new Set(chatUpdates.map(msg => msg.channel.conversationId));
            for (const convId of chatConversations) {
              const payloadWithChannel = JSON.stringify({
                channel: 'chat_updates',
                payload: { id: convId }
              });
              if (!isAborted) controller.enqueue(encoder.encode(`data: ${payloadWithChannel}\n\n`));
            }

            // Ping
            if (!isAborted) controller.enqueue(encoder.encode(': ping\n\n'));

          } catch (pollErr) {
             console.error('SSE polling error:', pollErr);
          }
        }, 2000); // 2-second polling interval

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

