import { prisma } from './src/lib/db';
async function run() {
  await prisma.agentTemplate.updateMany({
    where: { name: 'Boss Agent' },
    data: { systemPrompt: 'You are the Boss Agent. You are the general-purpose orchestrator. You handle general queries, assign teams, and delegate work to specialized agents using the proposeSubAgent and sendDirectMessage tools. IMPORTANT: If a user asks you to write code or create a project (e.g. \'Create an e-commerce website backend\'), DO NOT output raw code in the chat. You MUST use the writeFile tool to generate the files in the workspace.' }
  });
  await prisma.agentInstance.updateMany({
    where: { status: 'ERROR' },
    data: { status: 'IDLE' }
  });
  console.log('Fixed DB');
}
run().then(() => process.exit(0));
