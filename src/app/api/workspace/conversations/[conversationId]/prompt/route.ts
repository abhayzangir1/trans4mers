import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { AgentFactory } from '@/lib/AgentFactory';
import { getSessionId } from '@/lib/session';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ conversationId: string }> }
) {
  try {
    const sessionId = await getSessionId();
    const params = await props.params;
    const body = await request.json();
    const { prompt, targetAgentId } = body;
    
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    const conversation = await prisma.conversation.findUnique({
      where: { id: params.conversationId },
      include: { project: true }
    });

    if (!conversation || conversation.project.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let targetAgent = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Conversation" WHERE id = ${params.conversationId} FOR UPDATE`;
      
      if (targetAgentId) {
        return await tx.agentInstance.findUnique({
          where: { id: targetAgentId },
          include: { template: true }
        });
      }

      let templateToUse;
      const templates = await tx.agentTemplate.findMany();
      for (const t of templates) {
        if (prompt.toLowerCase().includes(`@${t.name.toLowerCase()}`)) {
          templateToUse = t;
          break;
        }
      }

      if (templateToUse) {
        // If a specific agent was mentioned, find an instance of it, or create it.
        let agent = await tx.agentInstance.findFirst({
          where: { conversationId: params.conversationId, templateId: templateToUse.id },
          include: { template: true }
        });
        if (!agent) {
          agent = await tx.agentInstance.create({
            data: {
              conversationId: params.conversationId,
              templateId: templateToUse.id,
              status: 'IDLE'
            },
            include: { template: true }
          });
        }
        return agent;
      } else {
        // No mention, fallback to the root agent (or create one)
        let agent = await tx.agentInstance.findFirst({
          where: { conversationId: params.conversationId, parentInstanceId: null },
          include: { template: true }
        });
        if (!agent) {
          const defaultTemplate = templates[0];
          if (!defaultTemplate) throw new Error('No agent templates available');
          agent = await tx.agentInstance.create({
            data: {
              conversationId: params.conversationId,
              templateId: defaultTemplate.id,
              status: 'IDLE'
            },
            include: { template: true }
          });
        }
        return agent;
      }
    });

    if (!targetAgent) {
      return NextResponse.json({ error: 'Target agent not found' }, { status: 404 });
    }

    const channelName = targetAgentId && ('template' in targetAgent) ? (targetAgent as any).template.name : 'shared-blackboard';

    let channel = await prisma.channel.upsert({
      where: {
        conversationId_name: {
          conversationId: params.conversationId,
          name: channelName
        }
      },
      create: {
        conversationId: params.conversationId,
        name: channelName,
        isDM: !!targetAgentId
      },
      update: {}
    });

    await prisma.message.create({
      data: {
        channelId: channel.id,
        senderId: 'human',
        role: 'user',
        content: prompt
      }
    });
    try {
      const payload = JSON.stringify({ id: params.conversationId });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({ success: true, agentInstanceId: targetAgent.id }) + '\n'));
          
          let isAborted = false;
          const pingInterval = setInterval(() => {
            if (!isAborted) {
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'ping' }) + '\n'));
            }
          }, 10000);

          try {
            await AgentFactory.runReActLoop(targetAgent.id, prompt, undefined, (progress) => {
               if (!isAborted) {
                 controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', data: progress }) + '\n'));
               }
            }, channel.id);
          } catch (err: unknown) {
            console.error('Background agent loop failed:', err);
            if (!isAborted) {
               controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: String(err) }) + '\n'));
            }
          } finally {
            clearInterval(pingInterval);
            if (!isAborted) {
               controller.close();
            }
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
    } catch (e: unknown) {
      console.error('Prompt dispatch error:', e);
      throw e;
    }
  } catch (error: unknown) {
    console.error('Error dispatching global prompt:', error);
    return NextResponse.json({ error: 'Failed to dispatch prompt' }, { status: 500 });
  }
}
