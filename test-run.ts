import { prisma } from './src/lib/db';
import { AgentFactory } from './src/lib/AgentFactory';

async function test() {
  const conv = await prisma.conversation.findFirst();
  if (!conv) {
    console.log('No conversation found');
    return;
  }
  
  const template = await prisma.agentTemplate.findFirst({ where: { name: 'Boss Agent' } });
  if (!template) {
    console.log('No Boss Agent template');
    return;
  }
  
  const agent = await prisma.agentInstance.findFirst({ where: { conversationId: conv.id, templateId: template.id } });
  if (!agent) {
    console.log('No Boss Agent instance');
    return;
  }
  
  console.log('Running agent loop...');
  try {
    const ch = await prisma.channel.findFirst({ where: { conversationId: conv.id, name: 'shared-blackboard' }});
    await AgentFactory.runReActLoop(agent.id, 'Create an e-commerce website backend', undefined, () => {}, ch.id);
    console.log('Done');
  } catch(e) {
    console.log('Error:', e);
  }
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
