import { ai } from './genkit';
import { z } from 'zod';
import { prisma } from './db';
import { MessageData } from 'genkit';
import { browserTool } from './tools/browserTool';
import { getSearchAndReplaceTool } from './tools/searchAndReplaceTool';
import { getFileSystemTools } from './tools/fileSystemTools';
import { runCommandTool } from './tools/commandTool';
import { getSwarmTools } from './tools/swarmTools';
import { getMessagingTools } from './tools/messagingTools';
import { DynamicMCPAdapter } from './mcpAdapter';
import { agentRegistry } from './AgentRegistry';

type GenkitTool = ReturnType<typeof ai.defineTool>;

const getTools = async (agentInstanceId: string, conversationId: string, triggerAgent: (targetId: string, message: string, channelId: string) => void) => {
  let sessionId = 'default';

  const requestHumanApprovalTool = ai.defineTool(
    {
      name: 'requestHumanApproval',
      description: 'Ask the human for approval before proceeding with a dangerous, destructive, or complex action (like spawning agents). You MUST provide a highly detailed explanation of exactly what you are about to do, which tools you will use, what the new agents will do, the expected outcome, and any risks.',
      inputSchema: z.object({
        reason: z.string().describe('A very detailed, multi-sentence reason explaining EXACTLY what you need approval for and how it will work.'),
      }),
      outputSchema: z.object({
        approved: z.boolean(),
        feedback: z.string().optional(),
      }),
    },
    async (input) => {
      return { approved: false, feedback: 'Human approval simulation is disabled in this environment.' };
    }
  );

  let tools: GenkitTool[] = [];
  const mcpAdapters: DynamicMCPAdapter[] = [];

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { project: true }
    });
    
    if (conversation?.project?.sessionId) {
      sessionId = conversation.project.sessionId;
    }
    
    tools = [
      requestHumanApprovalTool as unknown as GenkitTool,
      browserTool as unknown as GenkitTool,
      getSearchAndReplaceTool(sessionId) as unknown as GenkitTool,
      ...getFileSystemTools(sessionId) as unknown as GenkitTool[],
      runCommandTool as unknown as GenkitTool,
      ...getSwarmTools(agentInstanceId, conversationId) as unknown as GenkitTool[],
      ...getMessagingTools(agentInstanceId, conversationId, triggerAgent) as unknown as GenkitTool[],
    ];

    const settingsKey = sessionId ? `mcp_config_${sessionId}` : 'mcp_config';

    // Dynamically load config from isolated session settings
    const settings = await prisma.settings.findUnique({ where: { key: settingsKey } });
    const config = settings?.value as any /* eslint-disable-line @typescript-eslint/no-explicit-any */;

    if (config?.apiKeys) {
      if (config.apiKeys.openai) process.env.OPENAI_API_KEY = config.apiKeys.openai;
      if (config.apiKeys.anthropic) process.env.ANTHROPIC_API_KEY = config.apiKeys.anthropic;
      if (config.apiKeys.browserbase) process.env.BROWSERBASE_API_KEY = config.apiKeys.browserbase;
    }
    
    if (config && config.mcpServers) {
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers as Record<string, any>)) {
        if (!serverConfig.command) continue;
        
        // Use full path resolution or allow command directly if they specified npx/node
        const commandParts = serverConfig.command.split(' ');
        const cmd = commandParts[0];
        const args = [...commandParts.slice(1), ...(serverConfig.args || [])];

        const adapter = new DynamicMCPAdapter({
          type: 'stdio',
          command: cmd,
          args: args,
          env: serverConfig.env,
        });

        try {
          await adapter.connect();
          mcpAdapters.push(adapter);
          
          const mcpToolsList = await adapter.getTools() as { tools: { name: string, description: string, inputSchema: Record<string, unknown> }[] };
          
          if (mcpToolsList && mcpToolsList.tools) {
            for (const mcpTool of mcpToolsList.tools) {
              const proxyTool = ai.defineTool(
                {
                  name: `${serverName}_${mcpTool.name}`,
                  description: mcpTool.description,
                  inputSchema: z.record(z.string(), z.unknown()),
                  outputSchema: z.unknown(),
                },
                async (input) => {
                  return await adapter.callTool(mcpTool.name, input);
                }
              );
              tools.push(proxyTool);
            }
          }
        } catch (err: unknown) {
          console.warn(`Failed to connect to MCP server '${serverName}':`, err instanceof Error ? err.message : String(err));
        }
      }
    }
  } catch (err: unknown) {
    console.error('Failed to initialize MCP tools:', err instanceof Error ? err.message : String(err));
  }

  return { tools, mcpAdapter: mcpAdapters[0] };
};
export class AgentFactory {

  static async runReActLoop(
    agentInstanceId: string, 
    initialPrompt?: string, 
    signal?: AbortSignal, 
    onProgress?: (progress: string) => void,
    targetChannelId?: string
  ) {
    let mcpAdapter: DynamicMCPAdapter | null = null;
    
    // 0. Setup AbortController
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }
    const combinedSignal = controller.signal;
    let emitAgentUpdate: ((status: string) => Promise<void>) | null = null;

    try {
      // 1. Fetch Agent Instance Context
      const instance = await prisma.agentInstance.findUnique({
        where: { id: agentInstanceId },
        include: {
          template: true,
          conversation: {
            include: { project: true }
          }
        }
      });

      if (!instance) throw new Error('Agent instance not found');

      emitAgentUpdate = async (status: string) => {
        if (onProgress) onProgress(status);
        // PG Notify removed in favor of polling
      };

      // 2. Set RUNNING status (Atomic Lock) allowing IDLE or HALTED
      const updatedCount = await prisma.$executeRaw`
        UPDATE "AgentInstance" SET "status" = 'RUNNING' WHERE "id" = ${agentInstanceId} AND "status" IN ('IDLE', 'HALTED')
      `;
      if (updatedCount === 0) {
        console.log(`Agent ${agentInstanceId} is already running or halted. Aborting duplicate spawn.`);
        return { failed: true, reason: 'Duplicate or invalid state' };
      }

      // 2b. Register AbortController now that lock is secure
      agentRegistry.register(agentInstanceId, controller);

      if (emitAgentUpdate) await emitAgentUpdate('RUNNING');

    const logAgentThought = async (content: string) => {
      await prisma.agentLog.create({
        data: { agentInstanceId, content }
      });
      if (emitAgentUpdate) await emitAgentUpdate('RUNNING');
    };


      const { tools, mcpAdapter: adapter } = await getTools(agentInstanceId, instance.conversationId, (targetId, message, channelId) => {
        // Fire and forget the ReAct loop for the target agent
        AgentFactory.runReActLoop(targetId, `[MESSAGE FROM ${instance.template.name}] ${message}`, undefined, undefined, channelId).catch(err => {
          console.error('Failed to trigger agent via DM', err);
        });
      });
      mcpAdapter = adapter;

      await logAgentThought(`[SYSTEM] Initialized agent with context. Loading tools...`);

      const systemPreamble = `GLOBAL INSTRUCTIONS:
${instance.conversation.project.globalInstructions || 'None'}

ENTERPRISE FLEET / COLLABORATIVE PARTNER RULES:
- You are part of an enterprise multi-agent swarm.
- If you are the Boss Agent or receiving a general task, use the \`listAvailableAgents\` tool to discover what specialized agents are available.
- To delegate, use \`sendDirectMessage\` to contact a specific agent, or \`proposeSubAgent\` if you need to spawn a new instance of an agent blueprint.
- HUMAN-IN-THE-LOOP (HITL) IS MANDATORY: Whenever you are about to spawn a new agent (via proposeSubAgent), start a massive new unprompted task, or execute a potentially destructive action, you MUST call the \`requestHumanApproval\` tool FIRST. 
- You must explain to the human exactly what you are about to do and why. Wait for their approval before proceeding.

YOUR ROLE (${instance.template.name}):
${instance.template.systemPrompt}
`;
      
      let blackboard = await prisma.channel.findFirst({
        where: { conversationId: instance.conversationId, name: 'shared-blackboard' }
      });
      if (!blackboard) {
        blackboard = await prisma.channel.create({
          data: { conversationId: instance.conversationId, name: 'shared-blackboard' }
        });
      }

      const activeChannelId = targetChannelId || blackboard.id;
      const dmChannelsInit = await prisma.channel.findMany({
        where: { conversationId: instance.conversationId, isDM: true, name: instance.template.name }
      });
      const allChannelIds = [blackboard.id, ...dmChannelsInit.map(c => c.id)];

      const rawMessages = await prisma.message.findMany({
        where: { channelId: { in: allChannelIds } },
        orderBy: { createdAt: 'asc' }
      });

      let lastMessageFetchTime = rawMessages.length > 0 ? rawMessages[rawMessages.length - 1].createdAt : new Date();

      let history: MessageData[] = [
        { role: 'system', content: [{ text: systemPreamble }] }
      ];

      for (const msg of rawMessages) {
        let role = msg.role as 'user' | 'model' | 'system' | 'tool' | 'agent';
        let contentStr = msg.content;
        
        const channel = dmChannelsInit.find(c => c.id === msg.channelId);
        const prefix = channel ? `[DM from ${msg.senderId === 'human' ? 'User' : 'Agent ' + msg.senderId}]: ` : (role === 'agent' ? `[Peer Agent ${msg.senderId}]: ` : '');

        if (role === 'agent') {
          if (msg.senderId === agentInstanceId) {
            role = 'model';
          } else {
            role = 'user';
            contentStr = prefix + contentStr;
          }
        } else if (role === 'user') {
          contentStr = prefix + contentStr;
        }
        try {
          const parsedContent = JSON.parse(contentStr);
          if (Array.isArray(parsedContent)) {
             history.push({ role, content: parsedContent });
          } else {
             history.push({ role, content: [{ text: contentStr }] });
          }
        } catch {
          history.push({ role, content: [{ text: contentStr }] });
        }
      }
      
      let isDone = false;
      let finalResponse = '';
      let step = 0;
      const MAX_STEPS = 20;

      while (!isDone && step < MAX_STEPS) {
        if (combinedSignal.aborted) {
          throw new Error('AbortError');
        }

        // DB Status Check for cross-instance Halt/Fire
        const currentAgentState = await prisma.agentInstance.findUnique({
          where: { id: agentInstanceId },
          select: { status: true }
        });
        
        if (currentAgentState && ['HALTED', 'FIRED', 'STOPPED'].includes(currentAgentState.status)) {
          console.log(`[AgentFactory] Agent ${agentInstanceId} status is ${currentAgentState.status}, aborting loop.`);
          throw new Error('AbortError');
        }

        step++;
        await logAgentThought(`[REASONING] Step ${step} started... evaluating context.`);

        // Live Steering: Check for new user & peer messages
        const dmChannels = await prisma.channel.findMany({
          where: { conversationId: instance.conversationId, isDM: true, name: instance.template.name }
        });
        const channelIds = [blackboard.id, ...dmChannels.map(c => c.id)];

        const latestMsgs = await prisma.message.findMany({
          where: { 
            channelId: { in: channelIds },
            role: { in: ['user', 'agent'] },
            createdAt: { gt: lastMessageFetchTime }
          },
          orderBy: { createdAt: 'asc' }
        });
        
        if (latestMsgs.length > 0) {
          for (const msg of latestMsgs) {
            if (msg.senderId === agentInstanceId) {
              lastMessageFetchTime = msg.createdAt;
              continue; // Ignore our own just-saved messages
            }
            let role = msg.role as 'user' | 'model' | 'system' | 'tool' | 'agent';
            let contentStr = msg.content;
            
            const channel = dmChannels.find(c => c.id === msg.channelId);
            const prefix = channel ? `[DM from ${msg.senderId === 'human' ? 'User' : 'Agent ' + msg.senderId}]: ` : (role === 'agent' ? `[Peer Agent ${msg.senderId}]: ` : '');

            if (role === 'agent') {
               role = 'user';
            }
            contentStr = prefix + contentStr;
            
            history.push({ role, content: [{ text: contentStr }] });
            lastMessageFetchTime = msg.createdAt;
          }
          await logAgentThought(`[SYSTEM] Received new human/peer instruction(s). Injecting into context...`);
        }

        const tokenEstimate = JSON.stringify(history).length / 4;
        if (tokenEstimate > 100000) {
          let midIndex = Math.floor(history.length / 2);
          while (midIndex < history.length && history[midIndex].role === 'tool') {
            midIndex++;
          }
          const historyToSummarize = history.slice(1, midIndex);
          const remainingHistory = history.slice(midIndex);

          const summaryPrompt = `Summarize the following interaction strictly preserving facts, decisions, and outcomes:\n${JSON.stringify(historyToSummarize)}`;
          if (combinedSignal.aborted) throw new Error('AbortError');
          const summaryRes = await ai.generate({ model: 'vertexai/gemini-3.5-flash', prompt: summaryPrompt });

          history = [
            history[0], // Preserve System Preamble
            { role: 'user', content: [{ text: `[SYSTEM] Summary of earlier context: ${summaryRes.text}` }] },
            ...remainingHistory
          ];
          await logAgentThought(`[SYSTEM] Context compacted. Summary generated.`);
        }

        if (combinedSignal.aborted) {
            throw new Error('AbortError');
        }

        const generateWithRetry = async (retries = 3, delay = 2000): ReturnType<typeof ai.generate> => {
          try {
            return await ai.generate({
              model: 'vertexai/gemini-3.5-pro',
              messages: history,
              tools,
              returnToolRequests: true,
            });
          } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
            if (e.message?.includes('429') && retries > 0) {
              await logAgentThought(`[SYSTEM] 429 Rate Limit encountered. Retrying in ${delay/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              if (combinedSignal.aborted) throw new Error('AbortError');
              return generateWithRetry(retries - 1, delay * 2);
            }
            throw e;
          }
        };

        const response = await generateWithRetry();

        if (response.message) {
          history.push(response.message as MessageData);
          if (response.text) {
             await logAgentThought(`[THOUGHT] ${response.text}`);
             
             await prisma.message.create({
               data: {
                 channelId: activeChannelId,
                 senderId: agentInstanceId,
                 role: 'agent',
                 content: response.text.trim()
               }
             });
          }
        }

        const toolRequests = response.toolRequests;
        if (toolRequests && toolRequests.length > 0) {
          for (const part of toolRequests) {
            const tr = part.toolRequest;
            if (!tr) continue;

            if (tr.name === 'requestHumanApproval') {
              await logAgentThought(`[ACTION] Agent requested human approval. Halting loop.`);
              await prisma.message.create({
                data: {
                  channelId: activeChannelId,
                  senderId: agentInstanceId,
                  role: 'agent',
                  content: (tr.input as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).reason || 'I need your approval to proceed.',
                  requiresApproval: true,
                  approvalState: 'PENDING'
                }
              });
              isDone = true;
              break;
            }

            await logAgentThought(`[ACTION] Invoking tool: ${tr.name} with payload: ${JSON.stringify(tr.input)}`);
            // Genkit tools are wrapped functions, the real name is in __action.name
            const tool = tools.find((t: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => t.__action?.name === tr.name || t.name === tr.name);
            let result: unknown;
            
            if (tool) {
              try {
                if (combinedSignal.aborted) throw new Error('AbortError');
                // Execute the actual tool function
                result = await tool(tr.input);
              } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                const errMsg = e instanceof Error ? e.message : (e instanceof Error ? e.message : String(e));
                if (errMsg === 'AbortError' || (e as Error).name === 'AbortError') {
                   throw e;
                }
                result = { status: 'error', message: errMsg, data: null };
              }
            } else {
              result = { status: 'error', message: 'Tool not found', data: null };
            }

            await logAgentThought(`[ACTION_RESULT] Tool ${tr.name} output: ${JSON.stringify(result).substring(0, 200)}${JSON.stringify(result).length > 200 ? '...' : ''}`);

            const toolResponseContent = [{
              toolResponse: {
                ref: tr.ref,
                name: tr.name,
                output: result,
              }
            }];

            history.push({
              role: 'tool',
              content: toolResponseContent
            });
            // We intentionally do not persist tool responses to the chat UI 
            // to keep the frontend clean from backend JSON outputs.
          }
        } else {
          isDone = true;
          finalResponse = response.text || '';
          await logAgentThought(`[COMPLETED] Final Output: ${finalResponse}`);
        }
      }

      if (step >= MAX_STEPS) {
        finalResponse = "Error: Agent reached maximum reasoning steps.";
        await logAgentThought(`[ERROR] Reached MAX_STEPS without resolving.`);
        
        await prisma.message.create({
          data: {
            channelId: activeChannelId,
            senderId: agentInstanceId,
            role: 'agent',
            content: JSON.stringify([{ text: finalResponse }])
          }
        });

        await prisma.agentInstance.update({
          where: { id: agentInstanceId },
          data: { status: 'ERROR' },
        });
        if (emitAgentUpdate) await emitAgentUpdate('ERROR');
        return finalResponse;
      }

      await prisma.agentInstance.update({
        where: { id: agentInstanceId },
        data: { status: 'IDLE' },
      });

      if (emitAgentUpdate) await emitAgentUpdate('IDLE');

      return finalResponse;

    } catch (error: unknown) {
      const err = error as Error;
      console.error('Agent Loop Error:', err);
      
      if (err.name === 'AbortError' || err.message === 'AbortError') {
        await prisma.agentInstance.update({
          where: { id: agentInstanceId },
          data: { status: 'HALTED' },
        });
        if (emitAgentUpdate) await emitAgentUpdate('HALTED');
        return { failed: true, reason: 'Aborted' };
      }
      
      await prisma.agentInstance.update({
        where: { id: agentInstanceId },
        data: { status: 'ERROR' },
      });

      if (emitAgentUpdate) await emitAgentUpdate('ERROR');

      return { failed: true, reason: err.message };
    } finally {
      agentRegistry.unregisterIfMatches(agentInstanceId, controller);
      if (mcpAdapter) {
        await mcpAdapter.disconnect();
      }
    }
  }
}











