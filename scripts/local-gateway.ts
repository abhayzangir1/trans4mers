#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

const server = new Server(
  {
    name: 'trans4mers-local-gateway',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools available locally via the Gateway
const LOCAL_TOOLS: Tool[] = [
  {
    name: 'read_local_file',
    description: 'Reads a file securely from the isolated agent worktree.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The executing Task ID for workspace isolation.' },
        filePath: { type: 'string', description: 'Relative path to the file.' },
      },
      required: ['taskId', 'filePath'],
    },
  },
  {
    name: 'execute_local_command',
    description: 'Executes a safe shell command inside the isolated agent worktree.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The executing Task ID.' },
        command: { type: 'string', description: 'The shell command to run.' },
      },
      required: ['taskId', 'command'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: LOCAL_TOOLS,
  };
});

function getIsolatedWorktreePath(taskId: string): string {
  const baseDir = process.env.AGENT_WORKSPACE_DIR || '.trans4mers-workspaces';
  const worktreePath = path.join(process.cwd(), baseDir, taskId);
  if (!fs.existsSync(worktreePath)) {
    fs.mkdirSync(path.join(process.cwd(), baseDir), { recursive: true });
    try {
      execSync(`git worktree add "${worktreePath}" -b agent/${taskId}`, { stdio: 'pipe' });
    } catch (e: unknown) {
      console.warn(`Worktree setup warning for ${taskId}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return worktreePath;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args || typeof args !== 'object' || !('taskId' in args)) {
    throw new Error('Invalid arguments: taskId is required');
  }
  const taskId = String(args.taskId);
  const worktreePath = getIsolatedWorktreePath(taskId);

  if (name === 'read_local_file') {
    const filePath = String(args.filePath);
    const absoluteFilePath = path.resolve(worktreePath, filePath);
    if (!absoluteFilePath.startsWith(path.resolve(worktreePath))) {
      throw new Error('Security Error: Path traversal is not allowed.');
    }
    try {
      const content = fs.readFileSync(absoluteFilePath, 'utf8');
      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (e: unknown) {
      return {
        content: [{ type: 'text', text: `Error reading file: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  }

  if (name === 'execute_local_command') {
    const command = String(args.command);
    try {
      const output = execSync(command, { cwd: worktreePath, stdio: 'pipe' }).toString();
      return {
        content: [{ type: 'text', text: output }],
      };
    } catch (e: unknown) {
      return {
        content: [{ type: 'text', text: `Command Failed: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  }

  throw new Error(`Tool not found: ${name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
