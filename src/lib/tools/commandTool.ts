import { ai } from '../genkit';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
const execAsync = promisify(exec);

const AGENT_WORKSPACE_DIR = process.env.AGENT_WORKSPACE_DIR || '/tmp';

export const getCommandTool = (sessionId: string, projectId: string) => {
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

      const { stdout, stderr } = await execAsync(input.command, { cwd });
      return { success: true, stdout, stderr };
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      return { success: false, error: error.message, stderr: error.stderr };
    }
  });
};
