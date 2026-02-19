/**
 * GET /api/v1/alerts
 *
 * Returns a paginated list of alerts for the authenticated org.
 *
 * Query params:
 *   alert_type?:      'expiration' | 'renewal' | 'risk' | 'compliance'
 *   is_read?:         'true' | 'false'
 *   contract_id?:     UUID — filter to a specific contract's alerts
 *   include_snoozed?: 'true' | 'false' (default: false)
 *   page?:            number (default: 1)
 *   limit?:           number (max: 50, default: 20)
 *
 * Also returns unread count as a header: X-Unread-Count
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { listAlerts, getUnreadCount } from '../../../services/alert.service.js';
import { ValidationError } from '../../../lib/errors.js';
import type { AlertType } from '../../../services/alert.service.js';

const VALID_ALERT_TYPES: AlertType[] = ['expiration', 'renewal', 'risk', 'compliance'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function alertsListRoute(fastify: FastifyInstance) {
    fastify.get('/alerts', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const q = request.query as Record<string, string | undefined>;

        // ── Validate params ──────────────────────────────────
        const alertType = q['alert_type'] as AlertType | undefined;
        if (alertType && !VALID_ALERT_TYPES.includes(alertType)) {
            throw new ValidationError(`Invalid alert_type "${alertType}". Must be one of: ${VALID_ALERT_TYPES.join(', ')}`);
        }

        let isRead: boolean | undefined;
        if (q['is_read'] !== undefined) {
            if (q['is_read'] === 'true') isRead = true;
            else if (q['is_read'] === 'false') isRead = false;
            else throw new ValidationError('is_read must be "true" or "false"');
        }

        const contractId = q['contract_id'];
        if (contractId && !UUID_REGEX.test(contractId)) {
            throw new ValidationError('contract_id must be a valid UUID');
        }

        const includeSnoozed = q['include_snoozed'] === 'true';
        const page = Math.max(1, parseInt(q['page'] ?? '1', 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(q['limit'] ?? '20', 10) || 20));

        const orgId = request.user.orgId!;

        // ── Fetch alerts + unread count in parallel ───────────
        const [result, unreadCount] = await Promise.all([
            listAlerts({ orgId, alertType, isRead, contractId, includeSnoozed, page, limit }),
            getUnreadCount(orgId),
        ]);

        // Surface unread count in a header for badge updates
        reply.header('X-Unread-Count', String(unreadCount));

        return reply.send(result);
    });
}
