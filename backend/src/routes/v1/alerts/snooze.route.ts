/**
 * PATCH /api/v1/alerts/:id/snooze
 *
 * Snoozes an alert until a specified future date.
 * Snoozed alerts are hidden from the default alert list.
 *
 * Request body (JSON):
 *   { snoozedUntil: string }  // ISO 8601 datetime — must be in the future, max 365 days
 *
 * Also handles:
 *   POST /api/v1/alerts/:id/read   → marks the alert as read
 *   DELETE /api/v1/alerts/:id      → permanently dismisses the alert
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { snoozeAlert, markAlertsRead, dismissAlert } from '../../../services/alert.service.js';
import { ValidationError } from '../../../lib/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function alertActionsRoute(fastify: FastifyInstance) {
    // ── PATCH /alerts/:id/snooze ─────────────────────────────
    fastify.patch('/alerts/:id/snooze', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown>;

        if (!UUID_REGEX.test(id)) {
            throw new ValidationError('Alert ID must be a valid UUID');
        }

        const rawDate = body['snoozedUntil'];
        if (typeof rawDate !== 'string') {
            throw new ValidationError('"snoozedUntil" is required and must be an ISO 8601 datetime string');
        }

        const snoozedUntil = new Date(rawDate);
        if (isNaN(snoozedUntil.getTime())) {
            throw new ValidationError('"snoozedUntil" is not a valid date');
        }

        const alert = await snoozeAlert(id, request.user.orgId!, snoozedUntil);

        return reply.send({
            alert,
            message: `Alert snoozed until ${snoozedUntil.toISOString()}`,
        });
    });

    // ── POST /alerts/:id/read ──────────────────────────────
    fastify.post('/alerts/:id/read', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!UUID_REGEX.test(id)) {
            throw new ValidationError('Alert ID must be a valid UUID');
        }

        const updated = await markAlertsRead(request.user.orgId!, [id]);

        return reply.send({
            updated,
            message: updated > 0 ? 'Alert marked as read' : 'Alert was already read',
        });
    });

    // ── POST /alerts/read-all ──────────────────────────────
    fastify.post('/alerts/read-all', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const updated = await markAlertsRead(request.user.orgId!, []);

        return reply.send({
            updated,
            message: `${updated} alert(s) marked as read`,
        });
    });

    // ── DELETE /alerts/:id ─────────────────────────────────
    fastify.delete('/alerts/:id', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!UUID_REGEX.test(id)) {
            throw new ValidationError('Alert ID must be a valid UUID');
        }

        await dismissAlert(id, request.user.orgId!);

        return reply.status(204).send();
    });
}
