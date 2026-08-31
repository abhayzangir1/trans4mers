import { ai } from '@/lib/genkit';
import { z } from 'zod';
import { FileSystem } from '@/lib/FileSystem';
import * as path from 'path';

const AGENT_WORKSPACE_DIR = process.env.AGENT_WORKSPACE_DIR || '.trans4mers-workspaces';

export const getSearchAndReplaceTool = (sessionId: string, projectId: string) => ai.defineTool(
  {
    name: 'searchAndReplace',
    description: 'Safely replace a specific exact code block inside a file. Fails if target code is not found or matches multiple times.',
    inputSchema: z.object({
      filePath: z.string().describe('Relative path to the file'),
      targetCode: z.string().describe('The EXACT string to be replaced (must include correct whitespace/indentation)'),
      replacementCode: z.string().describe('The new string to insert in its place'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async (input) => {
    const { filePath, targetCode, replacementCode } = input;
    try {
      const cleanUserPath = filePath.replace(/\\/g, '/');
      const resolved = path.posix.normalize(cleanUserPath);
      if (resolved.startsWith('..') || resolved.startsWith('/')) {
        throw new Error('Path traversal detected');
      }
      const fullRelativePath = (!projectId || projectId === 'null' || projectId === 'undefined')
        ? path.posix.join(AGENT_WORKSPACE_DIR, sessionId, 'global_no_project', resolved)
        : path.posix.join(AGENT_WORKSPACE_DIR, sessionId, projectId, resolved);
      
      const content = await FileSystem.readFile(fullRelativePath);

      // Count occurrences of targetCode
      const occurrences = content.split(targetCode).length - 1;

      if (occurrences === 0) {
        return { 
          success: false, 
          message: `FAILED: Target code not found in file. Ensure you matched whitespace and indentation perfectly. Read the file again to get the exact string.` 
        };
      }

      if (occurrences > 1) {
        return { 
          success: false, 
          message: `FAILED: Target code matched ${occurrences} times. Make your targetCode more specific (e.g. include surrounding lines).` 
        };
      }

      const newContent = content.replace(targetCode, replacementCode);
      await FileSystem.writeFile(fullRelativePath, newContent);

      return { success: true, message: `Successfully replaced exact code block in ${filePath}` };
    } catch (err: unknown) {
      return { 
        success: false, 
        message: `Error: ${err instanceof Error ? err.message : String(err)}` 
      };
    }
  }
);

