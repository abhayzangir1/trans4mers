import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionId } from '@/lib/session';

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await props.params;

    const agent = await prisma.agentInstance.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const { validateConversationAccess } = await import('@/lib/withSession');
    const auth = await validateConversationAccess(agent.conversationId);
    if (!auth.authorized) {
      return auth.response;
    }

    await prisma.agentInstance.update({
      where: { id },
      data: { status: 'FIRED' }
    });

    const payload = { status: 'FIRED', agentInstanceId: id };
    const { sseBus } = await import('@/lib/sseBus');
    sseBus.emit(agent.conversationId, { type: 'agent_update', data: payload });
    return NextResponse.json({ success: true, message: 'Agent fired successfully' });
  } catch (error: unknown) {
    console.error('Error firing agent:', error);
    return NextResponse.json({ error: 'Failed to fire agent' }, { status: 500 });
  }
}
