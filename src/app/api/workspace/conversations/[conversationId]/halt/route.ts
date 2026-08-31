import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sseBus } from '@/lib/sseBus';
import { validateConversationAccess } from '@/lib/withSession';
import { agentRegistry } from '@/lib/AgentRegistry';

export async function POST(request: Request, props: { params: Promise<{ conversationId: string }> }) {
  try {
    const params = await props.params;

    // Session authorization
    const auth = await validateConversationAccess(params.conversationId);
    if (!auth.authorized) return auth.response;

    // Find running agents before halting
    const runningAgents = await prisma.agentInstance.findMany({
      where: {
        conversationId: params.conversationId,
        status: { in: ['RUNNING', 'HALTED'] }
      },
      select: { id: true }
    });

    // Abort their ReAct loops via the registry
    for (const agent of runningAgents) {
      agentRegistry.abort(agent.id);
    }

    const updated = await prisma.agentInstance.updateMany({
      where: {
        conversationId: params.conversationId,
        status: { in: ['RUNNING', 'HALTED'] }
      },
      data: {
        status: 'HALTED'
      }
    });

    // Notify UI via SSE
    sseBus.emit(params.conversationId, {
      type: 'agent_update',
      data: { id: params.conversationId, status: 'HALTED', haltedCount: updated.count }
    });

    return NextResponse.json({ success: true, haltedCount: updated.count });
  } catch (error: unknown) {
    console.error('Error halting swarm:', error);
    return NextResponse.json({ error: 'Failed to halt swarm' }, { status: 500 });
  }
}
