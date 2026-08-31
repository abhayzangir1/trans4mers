import { NextResponse } from 'next/server';
import { FileSystem } from '@/lib/FileSystem';
import { validateProjectAccess, validateConversationAccess } from '@/lib/withSession';
import path from 'path';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    const projectId = searchParams.get('projectId');
    const conversationId = searchParams.get('conversationId');

    if (!filePath) {
      return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
    }

    let allowedDirectory = '';
    if (projectId) {
      const auth = await validateProjectAccess(projectId);
      if (!auth.authorized) return auth.response!;
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project) allowedDirectory = project.directoryPath;
    } else if (conversationId) {
      const auth = await validateConversationAccess(conversationId);
      if (!auth.authorized) return auth.response!;
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { project: true } });
      if (conversation) allowedDirectory = conversation.project.directoryPath;
    }

    if (!allowedDirectory) {
      return NextResponse.json({ error: 'Missing or invalid project/conversation context' }, { status: 403 });
    }

    const resolvedPath = path.resolve(filePath);
    const resolvedAllowedDir = path.resolve(allowedDirectory);
    if (resolvedPath !== resolvedAllowedDir && !resolvedPath.startsWith(resolvedAllowedDir + path.sep)) {
      return NextResponse.json({ error: 'Invalid path traversal' }, { status: 403 });
    }

    // Assuming we want to return the raw content for local downloads for now
    // A robust GCS implementation might return a signed URL.
    const buffer = await FileSystem.readFileBuffer(filePath);
    
    // Determine mime type simply
    const ext = filePath.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'json') contentType = 'application/json';
    else if (ext === 'txt' || ext === 'md' || ext === 'csv') contentType = 'text/plain';

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filePath.split('/').pop()}"`
      }
    });
  } catch (error: unknown) {
    console.error('Error downloading file:', error);
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
  }
}
