import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkMessages() {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Latest Messages in Cloud DB:");
  messages.forEach(m => {
    console.log(`[${m.role}] ${m.content.substring(0, 100)}`);
  });
}
checkMessages().catch(console.error).finally(() => prisma.$disconnect());
