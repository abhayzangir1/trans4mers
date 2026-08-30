import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { FileSystem } from '@/lib/FileSystem';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string;
    const projectId = formData.get('projectId') as string;

    if (!file || !conversationId || !projectId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const safeConversationId = conversationId.replace(/[^a-zA-Z0-9-]/g, '');
    if (!safeConversationId) {
      return NextResponse.json({ error: 'Invalid conversationId' }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB Limit
      return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const uploadDir = `uploads/${safeConversationId}`;
    
    // Sanitize filename and prevent path traversal
    const safeName = path.basename(file.name || 'uploaded_file').replace(/[^a-zA-Z0-9.-]/g, '_');
    const relFilePath = `${uploadDir}/${safeName}`;
    
    await FileSystem.writeFile(relFilePath, buffer);

    const upload = await prisma.upload.create({
      data: {
        conversationId: safeConversationId,
        projectId,
        fileName: safeName,
        filePath: relFilePath,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      }
    });

    return NextResponse.json(upload);
  } catch (error: unknown) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: 'Upload failed', details: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    const uploads = await prisma.upload.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(uploads);
  } catch (error: unknown) {
    console.error("Error fetching uploads:", error);
    return NextResponse.json({ error: 'Failed to fetch uploads', details: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

