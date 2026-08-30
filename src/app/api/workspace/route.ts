import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { FileSystem } from '@/lib/FileSystem';
import { getSessionId } from '@/lib/session';
import path from 'path';

function getSecurePath(sessionId: string, userPath: string) {
  const safeRelativePath = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
  return `.trans4mers-workspaces/${sessionId}/${safeRelativePath}`;
}

export async function GET(request: Request) {
  try {
    const sessionId = await getSessionId();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'read_file') {
      const userPath = searchParams.get('path');
      if (!userPath) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

      try {
        const securePath = getSecurePath(sessionId, userPath);
        const content = await FileSystem.readFile(securePath);
        return NextResponse.json({ content });
      } catch (e: unknown) {
        return NextResponse.json({ error: 'File not found or unreadable' }, { status: 404 });
      }
    }

    if (action === 'list_files') {
      const userPath = searchParams.get('path') || '';
      try {
        const securePath = getSecurePath(sessionId, userPath);
        const files = await FileSystem.listFiles(securePath);
        
        // Strip the internal secure prefix before sending to client
        const prefixToRemove = `.trans4mers-workspaces/${sessionId}/`;
        const cleanFiles = files.map(f => {
          // Fix path slashes for consistent prefix removal across OS
          const normalizedF = f.replace(/\\/g, '/');
          const cleanF = normalizedF.startsWith(prefixToRemove) ? normalizedF.slice(prefixToRemove.length) : normalizedF;
          // Extract base name
          const name = cleanF.split('/').pop() || cleanF;
          return { name, path: cleanF, type: 'file' };
        });
        
        return NextResponse.json({ files: cleanFiles });
      } catch (e: unknown) {
        console.error(`Error listing files:`, e);
        return NextResponse.json({ files: [] });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    console.error("Workspace GET error:", error);
    return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await getSessionId();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'write_file') {
      const body = await request.json();
      const { path: userPath, content } = body;
      
      if (!userPath || content === undefined) {
        return NextResponse.json({ error: 'Missing path or content' }, { status: 400 });
      }

      const securePath = getSecurePath(sessionId, userPath);
      await FileSystem.writeFile(securePath, content);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_file') {
      const body = await request.json();
      const { path: userPath } = body;
      
      if (!userPath) {
        return NextResponse.json({ error: 'Missing path' }, { status: 400 });
      }

      const securePath = getSecurePath(sessionId, userPath);
      await FileSystem.deleteFile(securePath);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    console.error("Workspace POST error:", error);
    return NextResponse.json({ error: 'Failed to process workspace action' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const sessionId = await getSessionId();
    const { path: userPath, content } = await request.json();
    if (!userPath || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 });
    }
    const securePath = getSecurePath(sessionId, userPath);
    await FileSystem.writeFile(securePath, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save error:', error);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }
}


// Revision 22 trigger
