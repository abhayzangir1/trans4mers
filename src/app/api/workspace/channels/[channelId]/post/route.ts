import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionId } from '@/lib/session';
import { sseBus } from '@/lib/sseBus';
import { AgentFactory } from '@/lib/AgentFactory';

export async function POST(
  request: Request,
  props: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await props.params;
    const sessionId = await getSessionId();
    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { conversation: { include: { project: true } } }
    });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }
    
    if (channel.conversation.project.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const message = await prisma.message.create({
      data: {
        channelId: channelId,
        senderId: 'human',
        role: 'USER',
        content,
      }
    });

    sseBus.emit(channel.conversationId, {
      type: 'message_update',
      data: { channelId }
    });

    if (channel.name === 'shared-blackboard') {
      const allAgents = await prisma.agentInstance.findMany({
        where: { conversationId: channel.conversationId, status: { in: ['IDLE', 'ERROR', 'HALTED'] } }
      });
      for (const agent of allAgents) {
        after(() => {
          AgentFactory.runReActLoop(agent.id, `[USER POST TO BLACKBOARD]: ${content}`, undefined, undefined, channelId).catch(console.error);
        });
      }
    } else if (channel.isDM) {
      // Find the specific agent the DM is for. Channel name is "DM-<agentId>"
      const targetAgentId = channel.name.replace('DM-', '');
      const agent = await prisma.agentInstance.findFirst({
        where: { id: targetAgentId, status: { in: ['IDLE', 'ERROR', 'HALTED'] } }
      });
      if (agent) {
        after(() => {
          AgentFactory.runReActLoop(agent.id, `[USER DM]: ${content}`, undefined, undefined, channelId).catch(console.error);
        });
      }
    }

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Error posting message to channel:', error);
    return NextResponse.json({ error: error.message || 'Failed to post message' }, { status: 500 });
  }
}

