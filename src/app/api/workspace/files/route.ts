import { NextResponse } from 'next/server';
import { FileSystem } from '@/lib/FileSystem';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const directoryPath = searchParams.get('path');

    if (!directoryPath) {
      return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
    }

    const files = await FileSystem.listFiles(directoryPath);
    return NextResponse.json({ files });
  } catch (error: unknown) {
    console.error('Error listing files:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
