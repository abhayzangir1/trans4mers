import { prisma } from './db';
export class Overseer {
  static async checkSwarmHealth() {
    try {
      // 1. Mutex: Attempt to grab the lock
      const lockId = 'overseer_cron';
      const lockRes = await prisma.$executeRaw`
        INSERT INTO "SystemLock" ("id", "lockedAt", "expiresAt")
        VALUES (${lockId}, NOW(), NOW() + interval '5 minutes')
        ON CONFLICT ("id") DO UPDATE
        SET "lockedAt" = NOW(), "expiresAt" = NOW() + interval '5 minutes'
        WHERE "SystemLock"."expiresAt" < NOW()
      `;
      if (lockRes === 0) {
        // Another instance is already running the overseer for this cycle
        return;
      }

      const config = { enableOverseer: true, maxConcurrentAgents: 3 };

      if (config.enableOverseer === false) return;

      const activeConvs = await prisma.conversation.findMany({
        where: { status: 'ACTIVE' },
        include: {
          agentInstances: {
            where: { status: 'RUNNING' },
            include: { template: true }
          },
          channels: {
            where: { name: 'shared-blackboard' }
          }
        }
      });

      for (const conv of activeConvs) {
        if (conv.agentInstances.length > config.maxConcurrentAgents) {
          let blackboard = conv.channels[0];
          if (!blackboard) {
            blackboard = await prisma.channel.create({
              data: {
                conversationId: conv.id,
                name: 'shared-blackboard',
                isReadOnly: false
              }
            });
          }
          if (blackboard) {
            const recentOverseerMessage = await prisma.message.findFirst({
              where: {
                channelId: blackboard.id,
                senderId: 'overseer',
                requiresApproval: true,
                createdAt: {
                  gte: new Date(Date.now() - 5 * 60000)
                }
              }
            });
            if (recentOverseerMessage) continue;


            const agentDetails = conv.agentInstances.map(a => ({
              id: a.id,
              name: a.template?.name,
              role: a.template?.role,
              status: a.status,
              runtime: a.updatedAt ? (Date.now() - new Date(a.updatedAt).getTime()) / 1000 : 0
            }));

            const contentObj = {
              message: "High swarm activity detected.",
              agentCount: conv.agentInstances.length,
              agents: agentDetails,
              question: "Do you want to halt the newest agents?"
            };

            await prisma.message.create({
              data: {
                channelId: blackboard.id,
                senderId: 'overseer',
                role: 'system',
                content: JSON.stringify(contentObj, null, 2),
                requiresApproval: true,
                approvalState: 'PENDING'
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('[Overseer Error]', err);
    }
  }
}

