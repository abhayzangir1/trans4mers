import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';
import { getSessionId } from '@/lib/session';
import { FileSystem } from '@/lib/FileSystem';
import path from 'path';

export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const projects = await prisma.project.findMany({
      where: { sessionId },
      orderBy: { updatedAt: 'desc' },
      include: {
        conversations: {
          select: { id: true, title: true, status: true }
        }
      }
    });
    return NextResponse.json(projects);
  } catch (error: unknown) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await getSessionId();
    const body = await request.json();
    const projectId = randomUUID();
    const { name, description, directoryPath = `.trans4mers-workspaces/${sessionId}/${projectId}` } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Wrap in a transaction (Rule #6)
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: projectId,
          name,
          description,
          directoryPath,
          sessionId,
          globalInstructions: 'You are an advanced enterprise agent. Follow all system protocols.',
        },
      });

      const conversation = await tx.conversation.create({
        data: {
          projectId: project.id,
          title: 'General Chat',
        }
      });

      await tx.channel.create({
        data: {
          conversationId: conversation.id,
          name: 'shared-blackboard',
          isDM: false
        }
      });

      return { project, defaultConversationId: conversation.id };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Verify the project belongs to the session
    const project = await prisma.project.findFirst({
      where: { id: projectId, sessionId }
    });
    if (!project) {
      return NextResponse.json({ success: true, message: 'Already deleted' });
    }

    // Delete the actual workspace folder on disk to free space
    if (project.directoryPath) {
      await FileSystem.deleteDirectory(project.directoryPath);
    }

    // Delete the project from DB
    await prisma.project.delete({
      where: { id: projectId }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
