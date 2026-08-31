import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await context.params;
    const body = await request.json();
    const { agentId, agentName } = body;

    if (!conversationId || !agentId || !agentName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find or create the DM channel — use DM-<agentId> convention to match
    // messagingTools.ts, AgentFactory.ts, and post/route.ts
    const channelUniqueName = `DM-${agentId}`;
    const channel = await prisma.channel.upsert({
      where: {
        conversationId_name: {
          conversationId,
          name: channelUniqueName
        }
      },
      update: {},
      create: {
        conversationId,
        name: channelUniqueName,
        isDM: true
      }
    });

    return NextResponse.json(channel);
  } catch (error) {
    console.error('Failed to create/open DM:', error);
    return NextResponse.json({ error: 'Failed to create DM' }, { status: 500 });
  }
}
