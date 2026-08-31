import { prisma } from './src/lib/db';
async function test() {
  const logs = await prisma.agentLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  console.log(logs.map(l => l.content));
  const msgs = await prisma.message.findMany({ where: { role: 'AGENT' }, orderBy: { createdAt: 'desc' }, take: 10 });
  console.log(msgs.map(m => m.content));
}
test().then(() => process.exit(0));
