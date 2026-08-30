import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request, props: { params: Promise<{ conversationId: string }> }) {
  try {
    const params = await props.params;
    const updated = await prisma.agentInstance.updateMany({
      where: {
        conversationId: params.conversationId,
        status: { in: ['RUNNING', 'PENDING_APPROVAL'] } // Stop active or waiting agents
      },
      data: {
        status: 'HALTED'
      }
    });

    // Notify UI via SSE

    return NextResponse.json({ success: true, haltedCount: updated.count });
  } catch (error: unknown) {
    console.error('Error halting swarm:', error);
    return NextResponse.json({ error: 'Failed to halt swarm' }, { status: 500 });
  }
}
