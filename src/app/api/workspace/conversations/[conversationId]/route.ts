import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  props: { params: Promise<{ conversationId: string }> }
) {
  try {
    const params = await props.params;
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.conversationId },
      include: {
        project: true
      }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      title: conversation.title,
      projectName: conversation.project.name
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
