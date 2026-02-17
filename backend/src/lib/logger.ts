import pino, { type Logger, type LoggerOptions } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const devTransport: LoggerOptions['transport'] = {
    target: 'pino-pretty',
    options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
        singleLine: false,
    },
};

const loggerOptions: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),

    // Add base context to every log line
    base: {
        service: 'contractguard-api',
        env: process.env.NODE_ENV ?? 'development',
    },

    // Redact sensitive fields from logs
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'password',
            'token',
            'apiKey',
            'secret',
        ],
        censor: '[REDACTED]',
    },

    // Serialize request objects for Fastify
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            remoteAddress: req.ip,
            requestId: req.id,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
        err: pino.stdSerializers.err,
    },

    // ISO timestamps in production, epoch in dev
    timestamp: isDev
        ? pino.stdTimeFunctions.isoTime
        : pino.stdTimeFunctions.epochTime,

    // Pretty transport only in development
    ...(isDev && { transport: devTransport }),
};

/**
 * Root application logger.
 * Use `logger.child({ module: 'name' })` for per-module loggers.
 */
export const logger: Logger = pino(loggerOptions);

/**
 * Create a child logger with module context.
 *
 * @example
 * ```ts
 * const log = createLogger('contract.service');
 * log.info({ contractId }, 'Contract uploaded');
 * ```
 */
export function createLogger(module: string): Logger {
    return logger.child({ module });
}

/**
 * Fastify-compatible logger options.
 * Pass this to Fastify's `logger` option for integrated request logging.
 */
export const fastifyLoggerOptions: LoggerOptions = {
    ...loggerOptions,
    level: process.env.LOG_LEVEL ?? (isDev ? 'info' : 'warn'),
};

export default logger;
