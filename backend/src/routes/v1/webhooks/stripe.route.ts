/**
 * POST /api/v1/webhooks/stripe
 *
 * Receives and processes Stripe webhook events.
 * Verifies the Stripe-Signature header using the webhook signing secret.
 *
 * Handled events:
 *   - customer.subscription.created   → set org tier to 'pro' or 'enterprise'
 *   - customer.subscription.updated   → update org tier based on plan
 *   - customer.subscription.deleted   → downgrade org tier to 'free'
 *   - invoice.payment_failed          → log & optionally notify
 *   - checkout.session.completed      → link Stripe customer to org
 *
 * NOTE: This endpoint must NOT use authenticate middleware — it uses
 * Stripe signature verification for security instead.
 * The body must be the raw bytes (not JSON-parsed) for HMAC verification.
 */
import type { FastifyInstance } from 'fastify';
import { query } from '../../../db/client.js';
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('webhook.stripe');

// Stripe plan → internal tier mapping
const PRICE_TO_TIER: Record<string, string> = {
    // These should match your actual Stripe price IDs
    starter: 'starter',
    pro: 'pro',
    enterprise: 'enterprise',
};

function planToTier(planId: string): string {
    // Try to identify tier from plan name/id
    const lower = planId.toLowerCase();
    if (lower.includes('enterprise')) return 'enterprise';
    if (lower.includes('pro')) return 'pro';
    return PRICE_TO_TIER[lower] ?? 'starter';
}

export default async function stripeWebhookRoute(fastify: FastifyInstance) {
    fastify.post('/webhooks/stripe', {
        // Disable body parsing — we need the raw body for Stripe signature verification
        config: {
            rawBody: true,
            // No rate limit — Stripe IPs are trusted
        },
    }, async (request, reply) => {
        const stripeSignature = request.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            log.error('STRIPE_WEBHOOK_SECRET is not configured');
            return reply.status(500).send({ error: 'Webhook not configured' });
        }

        if (!stripeSignature) {
            log.warn({ ip: request.ip }, 'Stripe webhook missing signature');
            return reply.status(400).send({ error: 'Missing Stripe-Signature header' });
        }

        // ── Verify Stripe signature ────────────────────────────
        // Dynamically import stripe to keep it optional
        let stripe: import('stripe').Stripe;
        let event: import('stripe').Stripe.Event;

        try {
            const Stripe = (await import('stripe')).default;
            stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
                apiVersion: '2026-01-28.clover',
            });

            // The raw body must be a Buffer/string for signature verification
            const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody
                ?? Buffer.from(JSON.stringify(request.body));

            event = stripe.webhooks.constructEvent(
                rawBody,
                stripeSignature,
                webhookSecret,
            );
        } catch (err) {
            log.warn({ err }, 'Stripe signature verification failed');
            return reply.status(400).send({ error: 'Invalid Stripe signature' });
        }

        log.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

        // ── Handle events ─────────────────────────────────────
        try {
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object as import('stripe').Stripe.Checkout.Session;
                    await handleCheckoutCompleted(session);
                    break;
                }

                case 'customer.subscription.created':
                case 'customer.subscription.updated': {
                    const sub = event.data.object as import('stripe').Stripe.Subscription;
                    await handleSubscriptionUpsert(sub);
                    break;
                }

                case 'customer.subscription.deleted': {
                    const sub = event.data.object as import('stripe').Stripe.Subscription;
                    await handleSubscriptionDeleted(sub);
                    break;
                }

                case 'invoice.payment_failed': {
                    const invoice = event.data.object as import('stripe').Stripe.Invoice;
                    log.warn(
                        { customerId: invoice.customer, invoiceId: invoice.id },
                        'Stripe payment failed',
                    );
                    // TODO: send email notification via notification service
                    break;
                }

                default:
                    log.debug({ eventType: event.type }, 'Unhandled Stripe event type (ignored)');
            }
        } catch (err) {
            // Return 200 to Stripe anyway — returning 500 would cause retries
            // We log the error internally and can replay via Stripe dashboard
            log.error({ err, eventType: event.type, eventId: event.id }, 'Error processing Stripe event');
        }

        // Always acknowledge receipt to Stripe
        return reply.status(200).send({ received: true });
    });
}

// ─── Event Handlers ───────────────────────────────────────────

async function handleCheckoutCompleted(
    session: import('stripe').Stripe.Checkout.Session,
): Promise<void> {
    const orgId = session.metadata?.org_id;
    const customerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

    if (!orgId || !customerId) {
        log.warn({ sessionId: session.id }, 'checkout.session.completed missing org_id or customer metadata');
        return;
    }

    await query(
        `UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, orgId],
    );

    log.info({ orgId, customerId }, 'Stripe customer linked to org');
}

async function handleSubscriptionUpsert(
    sub: import('stripe').Stripe.Subscription,
): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const planId = sub.items.data[0]?.price?.id ?? '';
    const tier = planToTier(planId);

    const result = await query(
        `UPDATE organizations SET subscription_tier = $1, stripe_customer_id = $2
         WHERE stripe_customer_id = $2
         RETURNING id`,
        [tier, customerId],
    );

    if (result.rowCount === 0) {
        log.warn({ customerId, planId, tier }, 'No org found for Stripe customer on subscription upsert');
    } else {
        log.info({ customerId, planId, tier, rows: result.rowCount }, 'Org tier updated');
    }
}

async function handleSubscriptionDeleted(
    sub: import('stripe').Stripe.Subscription,
): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

    await query(
        `UPDATE organizations SET subscription_tier = 'free'
         WHERE stripe_customer_id = $1`,
        [customerId],
    );

    log.info({ customerId }, 'Org downgraded to free on subscription deletion');
}
