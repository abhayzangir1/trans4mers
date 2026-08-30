import { ai } from '@/lib/genkit';
import { z } from 'zod';
import { FileSystem } from '@/lib/FileSystem';
import * as path from 'path';

const AGENT_WORKSPACE_DIR = process.env.AGENT_WORKSPACE_DIR || '.trans4mers-workspaces';

export const getFileSystemTools = (sessionId: string) => {
  const readFileTool = ai.defineTool(
    {
      name: 'readFile',
      description: 'Read the contents of a file in the workspace.',
      inputSchema: z.object({
        filePath: z.string().describe('Relative path to the file'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        content: z.string().optional(),
        message: z.string(),
      }),
    },
    async (input) => {
      try {
        const safeRelativePath = path.normalize(input.filePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullRelativePath = path.join(AGENT_WORKSPACE_DIR, sessionId, safeRelativePath);
        const content = await FileSystem.readFile(fullRelativePath);
        return { success: true, content, message: "Successfully read file " + input.filePath };
      } catch (err: unknown) {
        return { success: false, message: "Error reading file: " + (err instanceof Error ? err.message : String(err)) };
      }
    }
  );

  const writeFileTool = ai.defineTool(
    {
      name: 'writeFile',
      description: 'Create a new file or completely overwrite an existing file with new content.',
      inputSchema: z.object({
        filePath: z.string().describe('Relative path to the file'),
        content: z.string().describe('The content to write to the file'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    },
    async (input) => {
      try {
        const safeRelativePath = path.normalize(input.filePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullRelativePath = path.join(AGENT_WORKSPACE_DIR, sessionId, safeRelativePath);
        await FileSystem.writeFile(fullRelativePath, input.content);
        return { success: true, message: "Successfully wrote to file " + input.filePath };
      } catch (err: unknown) {
        return { success: false, message: "Error writing file: " + (err instanceof Error ? err.message : String(err)) };
      }
    }
  );

  const listFilesTool = ai.defineTool(
    {
      name: 'listFiles',
      description: 'List all files in a directory within the workspace.',
      inputSchema: z.object({
        directoryPath: z.string().optional().describe('Relative path to the directory (empty for root)'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        files: z.array(z.string()).optional(),
        message: z.string(),
      }),
    },
    async (input) => {
      try {
        const dirPath = input.directoryPath || '';
        const safeRelativePath = path.normalize(dirPath).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullRelativePath = path.join(AGENT_WORKSPACE_DIR, sessionId, safeRelativePath);
        const files = await FileSystem.listFiles(fullRelativePath);
        
        // Strip the internal secure prefix before sending to agent
        const prefixToRemove = path.join(AGENT_WORKSPACE_DIR, sessionId) + '/';
        const cleanFiles = files.map(f => {
          const normalizedF = f.replace(/\\/g, '/');
          const cleanPrefix = prefixToRemove.replace(/\\/g, '/');
          return normalizedF.startsWith(cleanPrefix) ? normalizedF.slice(cleanPrefix.length) : normalizedF;
        });

        return { success: true, files: cleanFiles, message: "Successfully listed files in " + dirPath };
      } catch (err: unknown) {
        return { success: false, message: "Error listing files: " + (err instanceof Error ? err.message : String(err)) };
      }
    }
  );

  return [readFileTool, writeFileTool, listFilesTool];
};
