import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, props: { params: Promise<{ conversationId: string }> }) {
  try {
    const params = await props.params;
    // Find all channels belonging to this conversation
    const channels = await prisma.channel.findMany({
      where: { conversationId: params.conversationId },
      select: { id: true }
    });
    
    const channelIds = channels.map(c => c.id);

    // Find all pending approval messages in these channels
    const pendingApprovals = await prisma.message.findMany({
      where: {
        channelId: { in: channelIds },
        requiresApproval: true,
        approvalState: 'PENDING'
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(pendingApprovals);
  } catch (error: unknown) {
    console.error('Error fetching pending approvals:', error);
    return NextResponse.json({ error: 'Failed to fetch pending approvals' }, { status: 500 });
  }
}
