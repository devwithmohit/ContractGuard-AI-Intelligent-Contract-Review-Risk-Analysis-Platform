/**
 * POST /api/v1/auth/signup
 *
 * Public endpoint — creates a new user via Supabase Admin API
 * and sends a branded confirmation email through Resend.
 *
 * Flow:
 *   1. Validate email + password from request body
 *   2. Create user via supabase.auth.admin.generateLink({ type: 'signup' })
 *      — this creates the user WITHOUT sending Supabase's built-in email
 *      — returns an action_link for email confirmation
 *   3. Send confirmation email via Resend with professional template
 *   4. Return success message
 *
 * Auth: NONE (public route)
 * Body: { email: string, password: string }
 * Returns: { message: string }
 */
import type { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../../../lib/logger.js';
import { sendSignupConfirmationEmail } from '../../../services/email.service.js';

const log = createLogger('route.auth.signup');

// ─── Request / Response schemas ───────────────────────────────

interface SignupBody {
    email: string;
    password: string;
}

const signupBodySchema = {
    type: 'object' as const,
    required: ['email', 'password'],
    properties: {
        email: { type: 'string' as const, format: 'email' },
        password: { type: 'string' as const, minLength: 6 },
    },
    additionalProperties: false,
};

// ─── Route Plugin ─────────────────────────────────────────────

export default async function authSignupRoute(fastify: FastifyInstance) {
    fastify.post<{ Body: SignupBody }>(
        '/auth/signup',
        {
            schema: {
                body: signupBodySchema,
            },
        },
        async (request, reply) => {
            const { email, password } = request.body;

            log.info({ email }, 'Signup request received');

            // ── Build admin client ─────────────────────────────
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (!supabaseUrl || !supabaseServiceKey) {
                log.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
                return reply.status(500).send({
                    error: {
                        type: 'https://contractguard.app/errors/server-error',
                        title: 'Server Configuration Error',
                        status: 500,
                        detail: 'Authentication service is not properly configured.',
                        instance: request.url,
                    },
                });
            }

            const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            });

            // ── Create user + generate confirmation link ───────
            //    generateLink({ type: 'signup' }) creates the user
            //    WITHOUT sending Supabase's built-in email.
            const { data, error } = await adminClient.auth.admin.generateLink({
                type: 'signup',
                email,
                password,
                options: {
                    redirectTo: `${process.env.CORS_ORIGIN ?? 'http://localhost:5173'}/auth/callback`,
                },
            });

            if (error) {
                log.warn({ email, error: error.message }, 'Signup failed');

                // Specific error messages
                if (
                    error.message.includes('already been registered') ||
                    error.message.includes('already registered') ||
                    error.message.includes('User already registered')
                ) {
                    return reply.status(409).send({
                        error: {
                            type: 'https://contractguard.app/errors/conflict',
                            title: 'Conflict',
                            status: 409,
                            detail: 'This email is already registered. Try signing in instead.',
                            instance: request.url,
                        },
                    });
                }

                return reply.status(400).send({
                    error: {
                        type: 'https://contractguard.app/errors/client-error',
                        title: 'Signup Error',
                        status: 400,
                        detail: error.message,
                        instance: request.url,
                    },
                });
            }

            // ── Send confirmation email via Resend ─────────────
            const confirmUrl = data.properties?.action_link;

            if (!confirmUrl) {
                log.error({ email }, 'generateLink succeeded but no action_link returned');
                return reply.status(500).send({
                    error: {
                        type: 'https://contractguard.app/errors/server-error',
                        title: 'Server Error',
                        status: 500,
                        detail: 'Failed to generate confirmation link.',
                        instance: request.url,
                    },
                });
            }

            try {
                await sendSignupConfirmationEmail(email, confirmUrl);
                log.info({ email }, 'Signup confirmation email sent via Resend');
            } catch (emailErr) {
                // User was created but email failed — log and still return success
                // They can request a resend later
                log.error({ email, err: emailErr }, 'Failed to send confirmation email (user was created)');
            }

            return reply.status(201).send({
                message: 'Account created! Check your email to verify your address.',
            });
        },
    );
}
