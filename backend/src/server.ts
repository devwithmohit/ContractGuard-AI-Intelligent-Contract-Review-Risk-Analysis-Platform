import { buildApp } from './app.js';
import { createLogger } from './lib/logger.js';
import { closePool } from './db/client.js';
import { closeRedis } from './lib/redis.js';

const log = createLogger('server');

async function start() {
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

    // ─── Graceful Shutdown ───────────────────────────────────
    const shutdown = async (signal: string) => {
        log.info({ signal }, 'Received shutdown signal, closing gracefully...');

        try {
            // Stop accepting new requests
            await app.close();
            log.info('Fastify server closed');

            // Close database pool
            await closePool();

            // Close Redis connection
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
