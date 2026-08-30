import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;

    const agent = await prisma.agentInstance.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    await prisma.agentInstance.update({
      where: { id },
      data: { status: 'FIRED' }
    });

    const payload = JSON.stringify({ status: 'FIRED', agentInstanceId: id });

    return NextResponse.json({ success: true, message: 'Agent fired successfully' });
  } catch (error: unknown) {
    console.error('Error firing agent:', error);
    return NextResponse.json({ error: 'Failed to fire agent' }, { status: 500 });
  }
}
