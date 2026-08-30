import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionId } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const sessionId = await getSessionId();
    const body = await request.json();
    const { projectId, title } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: 'projectId and title are required' }, { status: 400 });
    }

    // Security check: ensure user owns the project
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const conversation = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          projectId,
          title,
        }
      });

      // Ensure the new conversation has a shared blackboard
      await tx.channel.create({
        data: {
          conversationId: conv.id,
          name: 'shared-blackboard',
          isDM: false
        }
      });

      return conv;
    });

    return NextResponse.json(conversation);
  } catch (error: unknown) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
