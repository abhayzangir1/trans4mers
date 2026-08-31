import { getSessionId } from './session';
import { prisma } from './db';
import { NextResponse } from 'next/server';

/**
 * Validates that a conversation belongs to the current session.
 * Returns the sessionId if valid, or a NextResponse error if not.
 */
export async function validateConversationAccess(conversationId: string): Promise<
  { authorized: true; sessionId: string } | { authorized: false; response: NextResponse }
> {
  const sessionId = await getSessionId();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { project: { select: { sessionId: true } } },
  });

  if (!conversation) {
    return { authorized: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  if (conversation.project.sessionId && conversation.project.sessionId !== sessionId) {
    return { authorized: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { authorized: true, sessionId };
}

/**
 * Validates that a channel belongs to the current session.
 */
export async function validateChannelAccess(channelId: string): Promise<
  { authorized: true; sessionId: string; conversationId: string } | { authorized: false; response: NextResponse }
> {
  const sessionId = await getSessionId();

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { conversation: { include: { project: { select: { sessionId: true } } } } },
  });

  if (!channel) {
    return { authorized: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  if (channel.conversation.project.sessionId && channel.conversation.project.sessionId !== sessionId) {
    return { authorized: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { authorized: true, sessionId, conversationId: channel.conversationId };
}

/**
 * Validates that a project belongs to the current session.
 */
export async function validateProjectAccess(projectId: string): Promise<
  { authorized: true; sessionId: string } | { authorized: false; response: NextResponse }
> {
  const sessionId = await getSessionId();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { sessionId: true },
  });

  if (!project) {
    return { authorized: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  if (project.sessionId && project.sessionId !== sessionId) {
    return { authorized: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { authorized: true, sessionId };
}
