import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export async function GET(request: Request, props: { params: Promise<{ conversationId: string }> }) {
  try {
    const params = await props.params;
    const { validateConversationAccess } = await import('@/lib/withSession');
    const auth = await validateConversationAccess(params.conversationId);
    if (!auth.authorized) return auth.response;
    const channels = await prisma.channel.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(channels);
  } catch (error: unknown) {
    console.error('Error fetching channels:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}
