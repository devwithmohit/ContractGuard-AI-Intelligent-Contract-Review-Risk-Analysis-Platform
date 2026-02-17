import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';

/**
 * Plugin: @fastify/multipart
 * Enables multipart/form-data file upload parsing.
 * Max file size: 50MB (as per system design).
 */
export default fp(
    async function multipartPlugin(fastify: FastifyInstance) {
        await fastify.register(multipart, {
            limits: {
                fileSize: 50 * 1024 * 1024,  // 50MB max file size
                files: 1,                      // Single file per request
                fieldSize: 1024,               // 1KB max per text field
                fields: 10,                    // Max 10 text fields
            },
            attachFieldsToBody: false,       // We'll use request.file() manually
        });
    },
    {
        name: 'multipart-plugin',
    },
);
