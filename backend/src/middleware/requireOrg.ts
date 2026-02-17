import type { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('middleware.requireOrg');

// Cache key prefix and TTL for org membership
const ORG_MEMBER_CACHE_PREFIX = 'orgmember:';
const ORG_MEMBER_CACHE_TTL = 300; // 5 minutes

/**
 * Org membership record from the database
 */
interface OrgMembership {
    org_id: string;
    role: 'owner' | 'admin' | 'member';
    subscription_tier: string;
}

/**
 * Middleware: requireOrg
 *
 * Verifies that the authenticated user belongs to an organization.
 * If the user's org_id is set in JWT app_metadata, validates membership.
 * Attaches org details to request.user.
 *
 * Must be used AFTER `authenticate` middleware.
 *
 * Usage:
 * ```ts
 * fastify.get('/contracts', {
 *   preHandler: [authenticate, requireOrg],
 * }, handler);
 * ```
 */
export async function requireOrg(
    request: FastifyRequest,
    _reply: FastifyReply,
): Promise<void> {
    const { user } = request;

    if (!user?.id) {
        throw new UnauthorizedError('Authentication required before org check');
    }

    // Try to get orgId from the JWT claims first
    let orgId = user.orgId;

    // If orgId not in JWT, look up the user's org membership from DB
    if (!orgId) {
        const membership = await lookupUserOrg(user.id);
        if (!membership) {
            throw new ForbiddenError(
                'You are not a member of any organization. Please create or join an organization first.',
            );
        }
        orgId = membership.org_id;

        // Update request.user with org details
        request.user.orgId = membership.org_id;
        request.user.tier = membership.subscription_tier;
    } else {
        // orgId was in JWT — verify membership is still valid
        const membership = await verifyOrgMembership(user.id, orgId);
        if (!membership) {
            throw new ForbiddenError(
                'You are no longer a member of this organization',
            );
        }

        // Update tier in case it changed since JWT was issued
        request.user.tier = membership.subscription_tier;
    }

    log.debug(
        { userId: user.id, orgId: request.user.orgId, tier: request.user.tier },
        'Org membership verified',
    );
}

/**
 * Middleware factory: requireOrgRole
 *
 * Verifies that the user has a specific role (or higher) within their org.
 * Role hierarchy: owner > admin > member
 *
 * Usage:
 * ```ts
 * fastify.delete('/contracts/:id', {
 *   preHandler: [authenticate, requireOrg, requireOrgRole('admin')],
 * }, handler);
 * ```
 */
export function requireOrgRole(...allowedRoles: Array<'owner' | 'admin' | 'member'>) {
    return async function checkRole(
        request: FastifyRequest,
        _reply: FastifyReply,
    ): Promise<void> {
        const { user } = request;

        if (!user?.id || !user.orgId) {
            throw new UnauthorizedError('Authentication and org membership required');
        }

        const membership = await verifyOrgMembership(user.id, user.orgId);
        if (!membership) {
            throw new ForbiddenError('You are not a member of this organization');
        }

        if (!allowedRoles.includes(membership.role)) {
            throw new ForbiddenError(
                `This action requires one of the following roles: ${allowedRoles.join(', ')}. Your role: ${membership.role}`,
            );
        }

        log.debug(
            { userId: user.id, role: membership.role, required: allowedRoles },
            'Role check passed',
        );
    };
}

// ─── Internal Helpers ────────────────────────────────────────

/**
 * Look up the first org membership for a user.
 * Used when orgId is not in the JWT claims.
 */
async function lookupUserOrg(userId: string): Promise<OrgMembership | null> {
    const cacheKey = `${ORG_MEMBER_CACHE_PREFIX}${userId}`;
    const cached = await cacheGet<OrgMembership>(cacheKey);
    if (cached) return cached;

    const result = await query<OrgMembership & { subscription_tier: string }>(
        `SELECT om.org_id, om.role, o.subscription_tier
     FROM org_members om
     JOIN organizations o ON om.org_id = o.id
     WHERE om.user_id = $1
     LIMIT 1`,
        [userId],
    );

    const membership = result.rows[0] ?? null;
    if (membership) {
        await cacheSet(cacheKey, membership, ORG_MEMBER_CACHE_TTL);
    }

    return membership;
}

/**
 * Verify that a user is a member of a specific org.
 * Returns membership details or null if not a member.
 */
async function verifyOrgMembership(
    userId: string,
    orgId: string,
): Promise<OrgMembership | null> {
    const cacheKey = `${ORG_MEMBER_CACHE_PREFIX}${userId}:${orgId}`;
    const cached = await cacheGet<OrgMembership>(cacheKey);
    if (cached) return cached;

    const result = await query<OrgMembership & { subscription_tier: string }>(
        `SELECT om.org_id, om.role, o.subscription_tier
     FROM org_members om
     JOIN organizations o ON om.org_id = o.id
     WHERE om.user_id = $1 AND om.org_id = $2`,
        [userId, orgId],
    );

    const membership = result.rows[0] ?? null;
    if (membership) {
        await cacheSet(cacheKey, membership, ORG_MEMBER_CACHE_TTL);
    }

    return membership;
}

export default requireOrg;
