import { buildApp } from './app.js';
import { createLogger } from './lib/logger.js';
import { closePool } from './db/client.js';
import { closePrisma } from './db/prisma.js';
import { closeRedis, connectRedis } from './lib/redis.js';
import { closeQueues, scheduleAlertCheck } from './services/queue.service.js';
import { startContractAnalysisWorker } from './workers/contractAnalysis.worker.js';
import { startEmbeddingWorker } from './workers/embedding.worker.js';
import { startAlertCheckWorker } from './workers/alertCheck.worker.js';
import type { Worker } from 'bullmq';

const log = createLogger('server');

async function start() {
    // Connect Redis before building app (rate limiter needs it)
    await connectRedis();

    const app = await buildApp();

    const port = parseInt(process.env.PORT ?? '3000', 10);
    const host = process.env.HOST ?? '0.0.0.0';

    try {
        await app.listen({ port, host });
        log.info({ port, host }, '🚀 ContractGuard API server started');
    } catch (err) {
        log.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }

    // ─── Start Workers ───────────────────────────────────────
    const workers: Worker[] = [];

    try {
        workers.push(startContractAnalysisWorker());
        workers.push(startEmbeddingWorker());
        workers.push(startAlertCheckWorker());

        // Schedule daily alert check cron (idempotent — clears old repeatable jobs first)
        await scheduleAlertCheck();

        log.info('✅ All workers started and alert cron scheduled');
    } catch (err) {
        log.error({ err }, 'Failed to start workers — server will continue without them');
    }

    // ─── Graceful Shutdown ───────────────────────────────────
    const shutdown = async (signal: string) => {
        log.info({ signal }, 'Received shutdown signal, closing gracefully...');

        try {
            // 1. Stop accepting new HTTP requests
            await app.close();
            log.info('Fastify server closed');

            // 2. Close all BullMQ workers (waits for in-flight jobs to finish)
            await Promise.all(workers.map((w) => w.close()));
            log.info('All workers closed');

            // 3. Close all BullMQ queue connections
            await closeQueues();
            log.info('All queues closed');

            // 4. Close database pool
            await closePool();

            // 4b. Close Prisma client
            await closePrisma();

            // 5. Close Redis connection (last — workers and queues need it above)
            await closeRedis();

            log.info('All connections closed. Goodbye! 👋');
            process.exit(0);
        } catch (err) {
            log.error({ err }, 'Error during shutdown');
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (err) => {
        log.fatal({ err }, 'Uncaught exception');
        shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
        log.fatal({ err: reason }, 'Unhandled rejection');
        shutdown('unhandledRejection');
    });
}

start();
