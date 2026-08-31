import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AgentFactory } from '@/lib/AgentFactory';
import { agentRegistry } from '@/lib/AgentRegistry';
import { sseBus } from '@/lib/sseBus';
import { validateConversationAccess } from '@/lib/withSession';

export async function POST(
  request: Request,
  props: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await props.params;
    const body = await request.json();
    const { action, customFeedback } = body; // action: 'APPROVED' or 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const existingMessage = await prisma.message.findUnique({ where: { id: messageId } });
    if (!existingMessage) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    const channel = await prisma.channel.findUnique({ where: { id: existingMessage.channelId } });
    if (!channel) {
      return NextResponse.json(existingMessage);
    }
    
    const access = await validateConversationAccess(channel.conversationId);
    if (!access.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newContent = customFeedback 
      ? `${existingMessage.content}\n\n[HUMAN FEEDBACK: ${action}] ${customFeedback}`
      : `${existingMessage.content}\n\n[HUMAN FEEDBACK: ${action}]`;

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        approvalState: action,
        content: newContent
      }
    });

    // Broadcast UI updates
    sseBus.emit(channel.conversationId, { type: 'message_update', data: { messageId, action } });

    // Rejection or Approval
    const targetAgent = await prisma.agentInstance.findFirst({
      where: { 
        id: existingMessage.senderId,
        status: { in: ['IDLE', 'HALTED'] } // The child agent is waiting to be run
      }
    });

    if (!targetAgent) {
       // Target not found or already running/halted
       return NextResponse.json(updatedMessage);
    }

    if (action === 'REJECTED') {
      await prisma.agentInstance.update({
        where: { id: targetAgent.id },
        data: { status: 'HALTED' }
      });
      return NextResponse.json(updatedMessage);
    }

    // Action is APPROVED, we need to stream the background loop
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify(updatedMessage) + '\n'));
        
        let isAborted = false;
        const pingInterval = setInterval(() => {
          if (!isAborted) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'ping' }) + '\n'));
          }
        }, 10000);

        try {
          await AgentFactory.runReActLoop(targetAgent.id, `Human APPROVED the action.`, undefined, (progress) => {
             if (!isAborted) controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', data: progress }) + '\n'));
          }, channel.id);
        } catch (err) {
          console.error('Background agent loop failed during approval execution:', err);
          if (!isAborted) controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: String(err) }) + '\n'));
        } finally {
          clearInterval(pingInterval);
          if (!isAborted) controller.close();
        }
      },
      cancel() {
        console.log('Stream cancelled by client');
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    console.error('Error updating approval:', error);
    return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 });
  }
}
