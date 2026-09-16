import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { badRequest, forbidden, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  PosApprovalRequest,
  type PosApprovalKind,
} from '../data/entities'
import {
  posApprovalDecideSchema,
  posApprovalRequestSchema,
  type PosApprovalDecideInput,
  type PosApprovalRequestInput,
} from '../data/validators'
import { emitSoanasPosEvent } from '../events'
import {
  POS_DISCOUNT_APPROVAL_FEATURE,
  POS_STOCK_APPROVAL_FEATURE,
  callerHasFeature,
  forkEm,
} from './helpers'

const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000

function featureForKind(kind: PosApprovalKind): string {
  if (kind === 'discount') return POS_DISCOUNT_APPROVAL_FEATURE
  return POS_STOCK_APPROVAL_FEATURE
}

function requireAuthUserId(ctx: CommandRuntimeContext): string {
  const userId = ctx.auth?.sub
  if (!userId) {
    throw forbidden('[internal] authenticated user required for POS approval')
  }
  return userId
}

export async function consumeApprovedApproval(
  em: EntityManager,
  args: {
    approvalRequestId: string
    tenantId: string
    organizationId: string
    kind: PosApprovalKind
    transactionId: string
    expectedPayload?: Record<string, unknown>
  },
): Promise<PosApprovalRequest> {
  const { translate } = await resolveTranslations()
  const approval = await em.findOne(
    PosApprovalRequest,
    {
      id: args.approvalRequestId,
      tenantId: args.tenantId,
      organizationId: args.organizationId,
    },
    { lockMode: LockMode.PESSIMISTIC_WRITE },
  )
  if (!approval) {
    throw notFound(translate('soanas_pos.errors.approval_not_found', 'POS approval request not found'))
  }
  if (approval.kind !== args.kind) {
    throw badRequest(translate('soanas_pos.errors.approval_kind_mismatch', 'Approval kind does not match'))
  }
  if (approval.transactionId && approval.transactionId !== args.transactionId) {
    throw badRequest(
      translate('soanas_pos.errors.approval_transaction_mismatch', 'Approval does not belong to this sale'),
    )
  }
  if (approval.status === 'consumed') {
    throw badRequest(translate('soanas_pos.errors.approval_already_consumed', 'Approval already consumed'))
  }
  if (approval.status !== 'approved') {
    throw badRequest(translate('soanas_pos.errors.approval_not_approved', 'Approval is not approved'))
  }
  if (approval.expiresAt && approval.expiresAt.getTime() < Date.now()) {
    approval.status = 'expired'
    throw badRequest(translate('soanas_pos.errors.approval_expired', 'Approval has expired'))
  }
  if (args.expectedPayload) {
    for (const [key, value] of Object.entries(args.expectedPayload)) {
      if (String(approval.payloadJson?.[key] ?? '') !== String(value ?? '')) {
        throw badRequest(
          translate('soanas_pos.errors.approval_payload_mismatch', 'Approval payload does not match the operation'),
        )
      }
    }
  }
  approval.status = 'consumed'
  approval.consumedAt = new Date()
  approval.updatedAt = new Date()
  return approval
}

const requestApprovalCommand: CommandHandler<
  PosApprovalRequestInput,
  { approvalRequestId: string; status: string; expiresAt: string | null }
> = {
  id: 'soanas_pos.approvals.request',
  async execute(input, ctx) {
    const parsed = posApprovalRequestSchema.parse(input)
    const requesterUserId = requireAuthUserId(ctx)
    const em = forkEm(ctx)
    let result = {
      approvalRequestId: '',
      status: 'pending',
      expiresAt: null as string | null,
    }

    await withAtomicFlush(
      em,
      [
        async () => {
          if (parsed.idempotencyKey) {
            const prior = await em.findOne(PosApprovalRequest, {
              tenantId: parsed.tenantId,
              idempotencyKey: parsed.idempotencyKey,
            })
            if (prior) {
              result = {
                approvalRequestId: prior.id,
                status: prior.status,
                expiresAt: prior.expiresAt ? prior.expiresAt.toISOString() : null,
              }
              return
            }
          }

          const now = new Date()
          const expiresAt =
            parsed.expiresAt ?? new Date(now.getTime() + DEFAULT_APPROVAL_TTL_MS)
          const approval = em.create(PosApprovalRequest, {
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
            terminalId: parsed.terminalId ?? null,
            transactionId: parsed.transactionId ?? null,
            lineId: parsed.lineId ?? null,
            kind: parsed.kind,
            status: 'pending',
            requesterUserId,
            reason: parsed.reason,
            payloadJson: parsed.payload ?? null,
            beforeJson: parsed.before ?? null,
            afterJson: parsed.after ?? null,
            idempotencyKey: parsed.idempotencyKey ?? null,
            expiresAt,
            createdAt: now,
            updatedAt: now,
          })
          em.persist(approval)
          await em.flush()
          result = {
            approvalRequestId: approval.id,
            status: approval.status,
            expiresAt: approval.expiresAt ? approval.expiresAt.toISOString() : null,
          }
        },
      ],
      { transaction: true, label: 'soanas_pos.approvals.request' },
    )

    await emitSoanasPosEvent('soanas.pos.approval.requested', {
      id: result.approvalRequestId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      kind: parsed.kind,
      transactionId: parsed.transactionId ?? null,
    })
    return result
  },
}

const decideApprovalCommand: CommandHandler<
  PosApprovalDecideInput,
  { approvalRequestId: string; status: string; approverUserId: string }
> = {
  id: 'soanas_pos.approvals.decide',
  async execute(input, ctx) {
    const parsed = posApprovalDecideSchema.parse(input)
    const approverUserId = requireAuthUserId(ctx)
    const { translate } = await resolveTranslations()
    const em = forkEm(ctx)
    let status = parsed.decision
    let kind: PosApprovalKind = 'discount'

    await withAtomicFlush(
      em,
      [
        async () => {
          const approval = await em.findOne(
            PosApprovalRequest,
            {
              id: parsed.approvalRequestId,
              tenantId: parsed.tenantId,
              organizationId: parsed.organizationId,
            },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          )
          if (!approval) {
            throw notFound(translate('soanas_pos.errors.approval_not_found', 'POS approval request not found'))
          }
          if (approval.status !== 'pending') {
            throw badRequest(
              translate('soanas_pos.errors.approval_not_pending', 'Approval is not pending'),
            )
          }
          if (approval.expiresAt && approval.expiresAt.getTime() < Date.now()) {
            approval.status = 'expired'
            throw badRequest(translate('soanas_pos.errors.approval_expired', 'Approval has expired'))
          }
          if (approval.requesterUserId === approverUserId) {
            throw forbidden(
              translate(
                'soanas_pos.errors.approval_self_forbidden',
                'The requester cannot approve their own request',
              ),
            )
          }
          const requiredFeature = featureForKind(approval.kind)
          const canDecide =
            (await callerHasFeature(ctx, requiredFeature)) ||
            (await callerHasFeature(ctx, POS_STOCK_APPROVAL_FEATURE))
          if (!canDecide) {
            throw forbidden(
              translate(
                'soanas_pos.errors.approval_forbidden',
                'You are not allowed to decide this POS approval',
              ),
            )
          }
          approval.status = parsed.decision
          approval.approverUserId = approverUserId
          approval.decisionReason = parsed.decisionReason ?? null
          approval.decidedAt = new Date()
          approval.updatedAt = new Date()
          status = approval.status
          kind = approval.kind
        },
      ],
      { transaction: true, label: 'soanas_pos.approvals.decide' },
    )

    await emitSoanasPosEvent('soanas.pos.approval.decided', {
      id: parsed.approvalRequestId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      status,
      kind,
      approverUserId,
    })
    return { approvalRequestId: parsed.approvalRequestId, status, approverUserId }
  },
}

registerCommand(requestApprovalCommand)
registerCommand(decideApprovalCommand)
