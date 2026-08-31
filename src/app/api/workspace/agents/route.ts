import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionId } from '@/lib/session';

export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.agentTemplate.findMany({
      orderBy: { createdAt: 'asc' },
      distinct: ['name']
    });
    return NextResponse.json(templates);
  } catch (error: unknown) {
    console.error('Error fetching agent templates:', error);
    return NextResponse.json({ error: 'Failed to fetch agent templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, role, systemPrompt, allowedTools } = body;

    if (!name || !role || !systemPrompt) {
      return NextResponse.json({ error: 'Name, role, and systemPrompt are required' }, { status: 400 });
    }

    const template = await prisma.agentTemplate.create({
      data: {
        name,
        role,
        systemPrompt,
        allowedTools: allowedTools || [],
      }
    });

    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error('Error creating agent template:', error);
    return NextResponse.json({ error: 'Failed to create agent template' }, { status: 500 });
  }
}

