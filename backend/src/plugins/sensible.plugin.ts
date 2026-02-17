import fp from 'fastify-plugin';
import sensible from '@fastify/sensible';
import type { FastifyInstance } from 'fastify';

/**
 * Plugin: @fastify/sensible
 * Adds HTTP error helpers (e.g., reply.notFound(), reply.badRequest())
 * and utility decorators to the Fastify instance.
 */
export default fp(
    async function sensiblePlugin(fastify: FastifyInstance) {
        await fastify.register(sensible, {
            sharedSchemaId: 'HttpError',
        });
    },
    {
        name: 'sensible-plugin',
    },
);
