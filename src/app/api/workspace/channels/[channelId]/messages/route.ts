import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { validateChannelAccess } from '@/lib/withSession';

export async function GET(request: Request, props: { params: Promise<{ channelId: string }> }) {
  try {
    const { channelId } = await props.params;
    const auth = await validateChannelAccess(channelId);
    if (!auth.authorized) return auth.response;

    const messages = await prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(messages);
  } catch (error: unknown) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ channelId: string }> }) {
  try {
    const { channelId } = await props.params;
    const auth = await validateChannelAccess(channelId);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const { content, role = 'USER', senderId = 'human' } = body;

    if (!content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        channelId,
        role,
        content,
        senderId: senderId || 'unknown'
      }
    });

    return NextResponse.json(message);
  } catch (error: unknown) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
