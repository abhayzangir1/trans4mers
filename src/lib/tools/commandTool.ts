import { ai } from '../genkit';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { prisma } from '../db';
const execAsync = promisify(exec);

const AGENT_WORKSPACE_DIR = process.env.AGENT_WORKSPACE_DIR || '.trans4mers-workspaces';

export const getCommandTool = (sessionId: string, projectId: string, conversationId?: string) => {
  return ai.defineTool({
    name: 'runCommand',
    description: 'Run a shell command in the secure workspace container.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute'),
    }),
  }, async (input) => {
    try {
      if (input.command.includes('cd /') || input.command.includes('../')) {
        return { success: false, error: 'Command restricted: "cd /" or "../" not allowed for security reasons.', stderr: '' };
      }
      const baseDir = path.resolve(AGENT_WORKSPACE_DIR);
      const cwd = (!projectId || projectId === 'null' || projectId === 'undefined')
        ? path.resolve(baseDir, sessionId, 'global_no_project')
        : path.resolve(baseDir, sessionId, projectId);
      if (!cwd.startsWith(baseDir + path.sep) && cwd !== baseDir) {
        throw new Error('Invalid path traversal detected');
      }
      
      const fs = require('fs');
      if (!fs.existsSync(cwd)) {
        fs.mkdirSync(cwd, { recursive: true });
      }

      let finalCommand = input.command;
      if (finalCommand.includes('create-next-app')) {
         // Remove any existing flags that might conflict
         finalCommand = finalCommand.replace(/--yes/g, '').replace(/--ts/g, '');
         finalCommand += ' --yes --ts --eslint --tailwind --app --src-dir --import-alias "@/*"';
      } else if (finalCommand.includes('npm install') && !finalCommand.includes('--yes')) {
         finalCommand += ' --yes';
      }

      const { stdout, stderr } = await execAsync(finalCommand, { cwd, timeout: 120000 });
      
      const output = (stdout || '') + (stderr || '');
      if (conversationId) {
        await prisma.commandExecution.create({
          data: { conversationId, command: finalCommand, output, exitCode: 0 }
        });
      }

      return { success: true, stdout, stderr };
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      const output = error.message + '\nSTDOUT:\n' + (error.stdout || '') + '\nSTDERR:\n' + (error.stderr || '');
      if (conversationId) {
        await prisma.commandExecution.create({
          data: { conversationId, command: input.command, output, exitCode: error.code || 1 }
        });
      }
      return { success: false, error: output, stderr: error.stderr };
    }
  });
};
