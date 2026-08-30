import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const where: Prisma.AgentLogWhereInput = { agentInstanceId: id };
    if (since) {
      where.createdAt = { gt: new Date(since) };
    }

    const logs = await prisma.agentLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    
    return NextResponse.json(logs);
  } catch (error: unknown) {
    console.error('Error fetching agent logs:', error);
    return NextResponse.json({ error: 'Failed to fetch agent logs' }, { status: 500 });
  }
}
