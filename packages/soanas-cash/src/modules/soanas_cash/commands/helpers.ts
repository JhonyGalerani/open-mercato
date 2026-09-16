import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { forbidden, notFound } from '@open-mercato/shared/lib/crud/errors'
import { hasFeature } from '@open-mercato/shared/security/features'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CashMovement, CashRegister, CashSession } from '../data/entities'
import { buildReconciliationTotals, type ReconciliationTotals } from '../lib/ledger'
import { APPROVAL_FEATURES, type ApprovalRequirement } from '../lib/policy'

export function forkEm(ctx: CommandRuntimeContext): EntityManager {
  return (ctx.container.resolve('em') as EntityManager).fork()
}

type RbacLike = {
  userHasAllFeatures?: (
    userId: string,
    required: string[],
    scope: { tenantId: string | null; organizationId: string | null },
  ) => Promise<boolean>
  getGrantedFeatures?: (
    userId: string,
    scope: { tenantId: string | null; organizationId: string | null },
  ) => Promise<string[]>
}

/** JWT does not embed ACL features — resolve live via rbacService. */
export async function resolveGrantedFeatures(ctx: CommandRuntimeContext): Promise<string[]> {
  if (ctx.systemActor) return ['*']
  if (!ctx.auth?.sub) return []
  const scope = {
    tenantId: ctx.auth.tenantId ?? null,
    organizationId: ctx.selectedOrganizationId ?? ctx.auth.orgId ?? null,
  }
  try {
    const rbac = ctx.container.resolve('rbacService') as RbacLike | undefined
    if (rbac?.getGrantedFeatures) {
      return await rbac.getGrantedFeatures(ctx.auth.sub, scope)
    }
  } catch {
    // rbacService may be absent in CLI / unit fixtures
  }
  const raw = ctx.auth?.features
  if (!Array.isArray(raw)) return []
  return raw.filter((value): value is string => typeof value === 'string')
}

export async function callerCanApprove(ctx: CommandRuntimeContext): Promise<boolean> {
  if (ctx.systemActor) return true
  if (!ctx.auth?.sub) return false
  const scope = {
    tenantId: ctx.auth.tenantId ?? null,
    organizationId: ctx.selectedOrganizationId ?? ctx.auth.orgId ?? null,
  }
  try {
    const rbac = ctx.container.resolve('rbacService') as RbacLike | undefined
    if (rbac?.userHasAllFeatures) {
      for (const feature of APPROVAL_FEATURES) {
        if (await rbac.userHasAllFeatures(ctx.auth.sub, [feature], scope)) return true
      }
      return false
    }
  } catch {
    // fall through
  }
  const granted = await resolveGrantedFeatures(ctx)
  return APPROVAL_FEATURES.some((feature) => hasFeature(granted, feature))
}

/**
 * Dual custody (REV-002). Approver identity is ALWAYS derived from the authenticated
 * session (`ctx.auth.sub`). Client-supplied `approverUserId` is ignored for authorization
 * (Gate 0) so a manager cannot attribute approval to another UUID without that user's session.
 */
export async function enforceDualCustody(args: {
  ctx: CommandRuntimeContext
  requirement: ApprovalRequirement
  operatorUserId: string
  /** @deprecated Ignored for identity — kept for call-site compatibility during migration. */
  approverUserId?: string | null | undefined
}): Promise<string | null> {
  const { ctx, requirement, operatorUserId } = args
  const { translate } = await resolveTranslations()

  if (!requirement.requiresApproval) return null

  const sessionApproverId = ctx.auth?.sub ?? null
  if (!sessionApproverId) {
    throw forbidden(
      translate('soanas_cash.errors.approval_required', 'Managerial approval required for this amount'),
    )
  }
  if (sessionApproverId === operatorUserId) {
    throw forbidden(
      translate(
        'soanas_cash.errors.self_approval',
        'Operator cannot approve their own cash movement (dual custody)',
      ),
    )
  }
  if (!(await callerCanApprove(ctx))) {
    throw forbidden(
      translate(
        'soanas_cash.errors.approval_feature_required',
        'Caller is not allowed to authorize cash movements above the register limit',
      ),
    )
  }
  return sessionApproverId
}

export async function loadRegisterOrThrow(
  em: EntityManager,
  scope: { id: string; tenantId: string; organizationId: string },
  options: { requireActive?: boolean } = {},
): Promise<CashRegister> {
  const register = await em.findOne(CashRegister, {
    id: scope.id,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
    ...(options.requireActive === false ? {} : { isActive: true }),
  })
  if (!register) {
    const { translate } = await resolveTranslations()
    throw notFound(translate('soanas_cash.errors.register_not_found', 'Cash register not found'))
  }
  return register
}

/**
 * Loads the session with a pessimistic write lock so concurrent withdrawals cannot both
 * read the same balance (REV-005). Drivers without row locks (unit-test EMs) fall back to
 * a plain read; the ledger checks still run.
 */
export async function loadSessionForUpdate(
  em: EntityManager,
  scope: { sessionId: string; tenantId: string; organizationId: string },
): Promise<CashSession> {
  const session = await em.findOne(
    CashSession,
    {
      id: scope.sessionId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    { lockMode: LockMode.PESSIMISTIC_WRITE },
  )
  if (!session) {
    const { translate } = await resolveTranslations()
    throw notFound(translate('soanas_cash.errors.session_not_found', 'Cash session not found'))
  }
  return session
}

/**
 * Rebuilds the session ledger from the append-only movement rows. `deletedAt` is
 * deliberately not part of the filter: confirmed movements are never soft-deleted, and
 * status alone decides whether a row counts (ADR-003 / REV-010).
 */
export async function loadSessionTotals(
  em: EntityManager,
  session: CashSession,
): Promise<{ totals: ReconciliationTotals; movements: CashMovement[] }> {
  const movements = await em.find(CashMovement, {
    sessionId: session.id,
    tenantId: session.tenantId,
  })
  const totals = buildReconciliationTotals(
    movements.map((movement) => ({
      type: movement.type,
      amountCents: BigInt(movement.amountCents),
      status: movement.status,
    })),
  )
  return { totals, movements }
}
