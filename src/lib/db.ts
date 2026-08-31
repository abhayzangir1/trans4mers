import { PrismaClient } from '@prisma/client';

const globalForDb = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForDb.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.prisma = prisma;
}
