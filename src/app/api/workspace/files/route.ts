import { NextResponse } from 'next/server';
import { FileSystem } from '@/lib/FileSystem';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const directoryPath = searchParams.get('path');

    const { getSessionId } = await import('@/lib/session');
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!directoryPath || directoryPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path parameter' }, { status: 400 });
    }

    const files = await FileSystem.listFiles(directoryPath);
    return NextResponse.json({ files });
  } catch (error: unknown) {
    console.error('Error listing files:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
