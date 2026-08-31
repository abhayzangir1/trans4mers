import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AgentFactory } from '@/lib/AgentFactory';
import { sseBus } from '@/lib/sseBus';
import { validateConversationAccess } from '@/lib/withSession';

export async function POST(request: Request, props: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await props.params;

    const access = await validateConversationAccess(conversationId);
    if (!access.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
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
    sseBus.emit(conversationId, {
      type: 'agent_update',
      data: { id: conversationId, status: 'RUNNING', resumedCount: haltedAgents.length }
    });

    const { after } = await import('next/server');
    after(() => {
      // Fire ReAct loops concurrently in the background
      Promise.allSettled(haltedAgents.map(agent => 
        AgentFactory.runReActLoop(agent.id)
      )).catch(console.error);
    });

    return NextResponse.json({ success: true, resumedCount: haltedAgents.length });

  } catch (error: unknown) {
    console.error('Error resuming swarm:', error);
    return NextResponse.json({ error: 'Failed to resume swarm' }, { status: 500 });
  }
}
