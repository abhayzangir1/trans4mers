import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateConversationAccess } from '@/lib/withSession';
import { getSessionId } from '@/lib/session';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { id, action, data } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing PTY id' }, { status: 400 });

    const access = await validateConversationAccess(id);
    if (!access.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'create') {
      return NextResponse.json({ success: true, id });
    }

    if (action === 'write') {
      const command = data?.trim();
      if (!command) return NextResponse.json({ success: true });

      // Security check: Block shell injection characters
      if (/[&|;$><`\n\r]/.test(command)) {
        return NextResponse.json({ error: 'Shell metacharacters are not allowed.' }, { status: 403 });
      }

      // Security check: Enforce safe base commands
      const baseCommand = command.split(' ')[0];
      const safeCommands = ['npm', 'npx', 'node', 'git', 'ls', 'dir', 'echo', 'cat', 'pwd', 'whoami', 'prisma'];
      if (!safeCommands.includes(baseCommand)) {
        return NextResponse.json({ error: `Command '${baseCommand}' is not in the allowlist.` }, { status: 403 });
      }

      // Determine the isolated workspace directory for this project
      const sessionId = await getSessionId();
      const conversation = await prisma.conversation.findUnique({
        where: { id: id },
        select: { projectId: true }
      });
      const projectId = conversation?.projectId || 'global_no_project';
      
      const AGENT_WORKSPACE_DIR = process.env.AGENT_WORKSPACE_DIR || '.trans4mers-workspaces';
      const path = await import('path');
      const fs = await import('fs');
      
      const cwd = path.resolve(process.cwd(), AGENT_WORKSPACE_DIR, sessionId, projectId);
      
      if (!fs.existsSync(cwd)) {
        fs.mkdirSync(cwd, { recursive: true });
      }

      // Execute strictly safe commands statelessly within the isolated directory
      try {
        const { stdout, stderr } = await execAsync(command, { 
          cwd,
          timeout: 5000 // 5s timeout
        });
        
        const output = (stdout || '') + (stderr || '');
        
        await prisma.commandExecution.create({
           data: { conversationId: id, command, output, exitCode: 0 }
        });
        
        return NextResponse.json({ success: true, output });
      } catch (err: unknown) {
        const output = ((err as Error & { stdout?: string }).stdout || "") + '\n' + ((err as Error & { stderr?: string }).stderr || "");
        await prisma.commandExecution.create({
           data: {
              conversationId: id,
              command,
              output: (err instanceof Error ? err.message : String(err)),
              exitCode: ((err as Error & { code?: number }).code) || 1
           }
        });
        return NextResponse.json({ success: true, output: (err instanceof Error ? err.message : String(err)) });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// Polling endpoint for latest output
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing PTY id' }, { status: 400 });

  const access = await validateConversationAccess(id);
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get most recent command execution for this id that was just created
  const recent = await prisma.commandExecution.findFirst({
     where: { conversationId: id },
     orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ output: recent?.output ?? '' });
}
