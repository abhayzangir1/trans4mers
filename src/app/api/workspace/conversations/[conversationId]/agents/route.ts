import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { validateConversationAccess } from '@/lib/withSession';

export async function GET(request: Request, props: { params: Promise<{ conversationId: string }> }) {
  try {
    const params = await props.params;
    const auth = await validateConversationAccess(params.conversationId);
    if (!auth.authorized) return auth.response;

    const agents = await prisma.agentInstance.findMany({
      where: { conversationId: params.conversationId },
      include: { template: true },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(agents);
  } catch (error: unknown) {
    console.error('Error fetching agent instances:', error);
    return NextResponse.json({ error: 'Failed to fetch agent instances' }, { status: 500 });
  }
}
