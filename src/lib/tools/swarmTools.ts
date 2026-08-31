import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ai } from '@/lib/genkit';

export const getSwarmTools = (agentInstanceId: string, conversationId: string) => {
  const proposeSubAgentTool = ai.defineTool(
    {
      name: 'proposeSubAgent',
      description: 'Propose a specialized sub-agent to assist with a task. You can dynamically define the agent\'s name, role, and system prompt. This creates a child agent instance that requires human approval before spawning.',
      inputSchema: z.object({
        name: z.string().describe('Name of the specialized sub-agent (e.g. Marketing Expert)'),
        role: z.string().describe('Role of the specialized sub-agent (e.g. Marketer)'),
        systemPrompt: z.string().describe('Detailed system prompt describing the sub-agent expertise and rules.'),
        instructions: z.string().describe('What the sub-agent needs to accomplish'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        subAgentInstanceId: z.string().optional(),
      }),
    },
    async (input) => {
      const { name, role, systemPrompt, instructions } = input;
      try {
        let template = await prisma.agentTemplate.findFirst({ where: { name } });
        if (!template) {
          template = await prisma.agentTemplate.create({
            data: { name, role, systemPrompt }
          });
        }
        
        const subInstance = await prisma.agentInstance.create({
          data: {
            conversationId,
            templateId: template.id,
            parentInstanceId: agentInstanceId,
            status: 'IDLE', // Waits for human execution
          }
        });

        // Broadcast to shared blackboard or general channel so human sees it
        const channel = await prisma.channel.upsert({
          where: {
            conversationId_name: { conversationId, name: 'shared-blackboard' }
          },
          update: {},
          create: { conversationId, name: 'shared-blackboard' }
        });

        await prisma.message.create({
          data: {
            channelId: channel.id,
            senderId: subInstance.id, // Fixed: use child ID so approval route can find it
            role: 'SYSTEM',
            content: `Requested approval to spawn sub-agent (Template: ${template.name}) with instructions: ${instructions}`,
            requiresApproval: true,
            approvalState: 'PENDING'
          }
        });

        return { 
          _hitl: true, // Special flag to engine
          success: true, 
          message: `Successfully proposed sub-agent. Human approval is required. ID: ${subInstance.id}`,
          subAgentInstanceId: subInstance.id
        };
      } catch (err: unknown) {
        return { success: false, message: `Failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  );

  const writeSharedBlackboardTool = ai.defineTool(
    {
      name: 'writeSharedBlackboard',
      description: 'Write a global fact or architectural decision to the Shared Blackboard for all agents to see.',
      inputSchema: z.object({
        key: z.string().describe('Unique key (e.g. API_SCHEMA)'),
        value: z.string().describe('The data or decision to store'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    },
    async (input) => {
      const { key, value } = input;
      try {
        // Upsert to KV store for programmatic reading
        await prisma.sharedBlackboard.upsert({
          where: {
            conversationId_key: {
              conversationId,
              key,
            }
          },
          update: { value },
          create: { conversationId, key, value }
        });

        // Also post it to the #shared-blackboard channel for humans/agents to read in Slack Mode
        const channel = await prisma.channel.upsert({
          where: {
            conversationId_name: { conversationId, name: 'shared-blackboard' }
          },
          update: {},
          create: { conversationId, name: 'shared-blackboard', isDM: false }
        });

        await prisma.message.create({
          data: {
            channelId: channel.id,
            senderId: agentInstanceId,
            role: 'AGENT',
            content: `**[BLACKBOARD MEMO: ${key}]**\n${value}`
          }
        });

        return { success: true, message: `Saved ${key} to Shared Blackboard.` };
      } catch (err: unknown) {
        return { success: false, message: `Failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  );

  const readSharedBlackboardTool = ai.defineTool(
    {
      name: 'readSharedBlackboard',
      description: 'Read a global fact or architectural decision from the Shared Blackboard.',
      inputSchema: z.object({
        key: z.string().describe('Unique key (e.g. API_SCHEMA)'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        value: z.string().optional(),
        message: z.string(),
      }),
    },
    async (input) => {
      const { key } = input;
      try {
        const record = await prisma.sharedBlackboard.findUnique({
          where: {
            conversationId_key: { conversationId, key }
          }
        });
        if (!record) return { success: false, message: `Key ${key} not found.` };
        return { success: true, value: record.value, message: 'Read successful.' };
      } catch (err: unknown) {
        return { success: false, message: `Failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  );

  const listAvailableAgentsTool = ai.defineTool(
    {
      name: 'listAvailableAgents',
      description: 'List all available agent templates (blueprints) that can be proposed or delegated to.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        success: z.boolean(),
        agents: z.array(z.object({
          id: z.string(),
          name: z.string(),
          role: z.string(),
          systemPrompt: z.string().optional()
        })).optional(),
        message: z.string()
      }),
    },
    async () => {
      try {
        const templates = await prisma.agentTemplate.findMany({
          select: { id: true, name: true, role: true, systemPrompt: true }
        });
        return { success: true, agents: templates, message: 'Successfully fetched available agents' };
      } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        return { success: false, message: 'Failed to fetch available agents: ' + err.message };
      }
    }
  );

  return [proposeSubAgentTool, writeSharedBlackboardTool, readSharedBlackboardTool, listAvailableAgentsTool];
};


