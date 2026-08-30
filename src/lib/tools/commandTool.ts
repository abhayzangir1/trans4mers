import { ai } from '../genkit';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export const runCommandTool = ai.defineTool({
  name: 'runCommand',
  description: 'Run a shell command in the secure workspace container.',
  schema: z.object({
    command: z.string().describe('The shell command to execute'),
  }),
}, async (input) => {
  try {
    const { stdout, stderr } = await execAsync(input.command, { cwd: process.env.AGENT_WORKSPACE_DIR || '/tmp' });
    return { success: true, stdout, stderr };
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    return { success: false, error: error.message, stderr: error.stderr };
  }
});


