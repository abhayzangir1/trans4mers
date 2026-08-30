import { NextResponse } from 'next/server';
import { FileSystem } from '@/lib/FileSystem';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
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
