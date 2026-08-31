import { NextResponse, NextRequest, after } from 'next/server';
import { prisma } from '@/lib/db';
import { AgentFactory } from '@/lib/AgentFactory';
import { getSessionId } from '@/lib/session';
import { sseBus } from '@/lib/sseBus';
import { validateConversationAccess } from '@/lib/withSession';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ conversationId: string }> }
) {
  try {
    const params = await props.params;
    const auth = await validateConversationAccess(params.conversationId);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const { prompt, targetAgentId } = body;
    
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

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
          let defaultTemplate = templates.find(t => t.name === 'Boss Agent');
          
          if (!defaultTemplate) {
            defaultTemplate = await tx.agentTemplate.create({
              data: {
                name: 'Boss Agent',
                role: 'Chief AI Orchestrator',
                systemPrompt: 'You are the Boss Agent. You are the general-purpose orchestrator. You handle general queries, assign teams, and delegate work to specialized agents using the proposeSubAgent and sendDirectMessage tools.',
                allowedTools: []
              }
            });
          }

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

    const channelName = targetAgentId ? `DM-${targetAgent.id}` : 'shared-blackboard';

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
    // Emit SSE event for the new human message
    sseBus.emit(params.conversationId, {
      type: 'message_update',
      data: { channelId: channel.id }
    });
    
    // Fire and forget the agent loop using Next.js after()
    after(() => {
      AgentFactory.runReActLoop(targetAgent.id, prompt, undefined, () => {}, channel.id).catch(err => {
        console.error('Background agent loop failed:', err);
      });
    });

    return NextResponse.json({ success: true, agentInstanceId: targetAgent.id });
  } catch (error: unknown) {
    console.error('Error dispatching global prompt:', error);
    return NextResponse.json({ error: 'Failed to dispatch prompt' }, { status: 500 });
  }
}
