import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ai } from '@/lib/genkit';

export const getMessagingTools = (
  agentInstanceId: string, 
  conversationId: string,
  triggerAgent: (targetAgentId: string, message: string, channelId: string) => void
) => {
  const sendDirectMessageTool = ai.defineTool(
    {
      name: 'sendDirectMessage',
      description: 'Send a direct message to a specific agent by their template name or ID. Use this for targeted communication instead of broadcasting to the blackboard.',
      inputSchema: z.object({
        targetAgentNameOrId: z.string().describe('The name (e.g. "Database & Prisma Auditor") or ID of the agent you want to message.'),
        message: z.string().describe('The content of the message.'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    },
    async (input) => {
      const { targetAgentNameOrId, message } = input;
      try {
        // Try finding agent by exact ID first
        let targetAgent = await prisma.agentInstance.findFirst({
          where: { id: targetAgentNameOrId, conversationId }
        });

        // If not found by ID, try finding by template name
        if (!targetAgent) {
           targetAgent = await prisma.agentInstance.findFirst({
             where: { 
               conversationId,
               template: { name: targetAgentNameOrId }
             },
             include: { template: true }
           });
        }

        if (!targetAgent) {
          return { success: false, message: `Failed: Could not find agent matching "${targetAgentNameOrId}" in this conversation.` };
        }

        if (targetAgent.status === 'IDLE' || targetAgent.status === 'HALTED') {
          const hasPendingApproval = await prisma.message.findFirst({
            where: { senderId: targetAgent.id, requiresApproval: true, approvalState: 'PENDING' }
          });
          if (hasPendingApproval) {
            return { success: false, message: `Failed: Cannot trigger agent "${targetAgentNameOrId}"; it is awaiting human approval.` };
          }
        }

        let targetAgentName = targetAgentNameOrId;
        if (!('template' in targetAgent)) {
           const fullAgent = await prisma.agentInstance.findUnique({
               where: { id: targetAgent.id },
               include: { template: true }
           });
           targetAgentName = fullAgent?.template.name || 'Unknown Agent';
        } else {
           targetAgentName = (targetAgent as { template: { name: string } }).template.name;
        }

        const channelUniqueName = `DM-${[agentInstanceId, targetAgent.id].sort().join('-')}`;

        const channel = await prisma.channel.upsert({
          where: {
             conversationId_name: { conversationId, name: channelUniqueName }
          },
          update: {},
          create: { conversationId, name: channelUniqueName, isDM: true }
        });

        await prisma.message.create({
          data: {
            channelId: channel.id,
            senderId: agentInstanceId,
            role: 'AGENT',
            content: message
          }
        });

        // Fire and forget the orchestrator loop for the target agent
        triggerAgent(targetAgent.id, message, channel.id);

        return { success: true, message: `Successfully sent direct message to ${targetAgentName}.` };
      } catch (err: unknown) {
        return { success: false, message: `Failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  );

  return [sendDirectMessageTool];
};
