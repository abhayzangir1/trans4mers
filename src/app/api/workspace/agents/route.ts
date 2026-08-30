import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const templates = await prisma.agentTemplate.findMany({
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(templates);
  } catch (error: unknown) {
    console.error('Error fetching agent templates:', error);
    return NextResponse.json({ error: 'Failed to fetch agent templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

