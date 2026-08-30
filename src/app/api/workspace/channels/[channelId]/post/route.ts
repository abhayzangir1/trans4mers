import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionId } from '@/lib/session';

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
        role: 'user',
        content,
      }
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Error posting message to channel:', error);
    return NextResponse.json({ error: error.message || 'Failed to post message' }, { status: 500 });
  }
}

