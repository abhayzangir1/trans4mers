import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    // Find the agent instance
    const agent = await prisma.agentInstance.findUnique({
      where: { id }
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Update status to HALTED
    const updated = await prisma.agentInstance.update({
      where: { id },
      data: { status: 'HALTED' }
    });

    // Notify listeners via prisma raw query (even though pgBouncer drops it, UI polling handles it anyway)
    
    await prisma.agentLog.create({
      data: {
        agentInstanceId: id,
        content: '[SYSTEM] Micro-halt triggered by user. Agent execution stopped.'
      }
    });

    return NextResponse.json({ success: true, agent: updated });
  } catch (err: unknown) {
    console.error('Error halting agent:', err);
    return NextResponse.json({ error: 'Failed to halt agent' }, { status: 500 });
  }
}
