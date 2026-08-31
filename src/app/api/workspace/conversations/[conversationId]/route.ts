import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateConversationAccess } from '@/lib/withSession';

export async function GET(
  request: Request,
  props: { params: Promise<{ conversationId: string }> }
) {
  try {
    const params = await props.params;
    
    const auth = await validateConversationAccess(params.conversationId);
    if (!auth.authorized) return auth.response;
    
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

export async function DELETE(
  request: Request,
  props: { params: Promise<{ conversationId: string }> }
) {
  try {
    const params = await props.params;
    
    const { getSessionId } = await import('@/lib/session');
    const sessionId = await getSessionId();
    
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.conversationId },
      include: { project: { select: { sessionId: true } } },
    });

    // Idempotency: if it's already gone, consider it a success
    if (!conversation) {
      return NextResponse.json({ success: true, message: 'Already deleted' });
    }

    if (!conversation.project.sessionId || conversation.project.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Delete the conversation's uploaded files folder from disk
    try {
      const { FileSystem } = await import('@/lib/FileSystem');
      const safeConversationId = params.conversationId.replace(/[^a-zA-Z0-9-]/g, '');
      if (safeConversationId) {
        await FileSystem.deleteDirectory(`uploads/${safeConversationId}`);
      }
    } catch (err) {
      console.warn('Failed to delete conversation upload directory:', err);
    }

    await prisma.conversation.delete({
      where: { id: params.conversationId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
