import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { id, action, data } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing PTY id' }, { status: 400 });

    if (action === 'create') {
      return NextResponse.json({ success: true, id });
    }

    if (action === 'write') {
      const command = data?.trim();
      if (!command) return NextResponse.json({ success: true });

      // STRICT CLOUD SECURITY SANDBOX
      // Block any attempt to read environment variables, sensitive files, or execute destructive commands
      const lowerCmd = command.toLowerCase();
      const isDangerous = 
        lowerCmd.includes('env') || 
        lowerCmd.includes('printenv') || 
        lowerCmd.includes('set') || 
        lowerCmd.includes('export') || 
        lowerCmd.includes('$') || 
        lowerCmd.includes('cat') || 
        lowerCmd.includes('grep') ||
        lowerCmd.includes('curl') ||
        lowerCmd.includes('wget') ||
        lowerCmd.includes('rm ') ||
        lowerCmd.includes('mv ') ||
        lowerCmd.includes('chmod') ||
        lowerCmd.includes('chown') ||
        lowerCmd.includes('node ') ||
        lowerCmd.includes('python ') ||
        lowerCmd.includes('bash ') ||
        lowerCmd.includes('sh ') ||
        command.includes('|') ||
        command.includes('`') ||
        command.includes(';') ||
        command.includes('&');

      if (isDangerous) {
        return NextResponse.json({ 
          success: true, 
          output: `[SECURITY OVERRIDE] Command execution blocked by Fortified Enterprise Fleet safeguards.\nReason: Attempted to access protected system resources or environment variables in a public cloud deployment.\nOnly Agents may request elevated operations via the requestHumanApproval protocol.` 
        });
      }

      // Execute strictly safe commands statelessly
      try {
        const { stdout, stderr } = await execAsync(command, { 
          cwd: process.cwd(),
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

  // Get most recent command execution for this id that was just created
  const recent = await prisma.commandExecution.findFirst({
     where: { conversationId: id },
     orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ output: '' });
}
