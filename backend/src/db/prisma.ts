/**
 * Prisma Client Singleton
 *
 * Provides a global Prisma client instance for use alongside the existing pg queries.
 * Import this when you need Prisma ORM features (typed queries, relations, etc.).
 * The raw pg client in db/client.ts continues to work for existing query functions.
 *
 * Datasource URL is configured in prisma.config.ts (Prisma v7+).
 */
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { createLogger } from '../lib/logger.js';

const log = createLogger('prisma');

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const connectionString = process.env.PRISMA_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    log.info('Prisma client initialized');
  }
  return prisma;
}

export async function closePrisma(): Promise<void> {
  if (prisma) {
    log.info('Closing Prisma client...');
    await prisma.$disconnect();
    prisma = null;
    log.info('Prisma client closed');
  }
}

export default { getPrisma, closePrisma };
