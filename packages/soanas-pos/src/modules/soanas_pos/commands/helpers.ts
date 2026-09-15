import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { badRequest, forbidden, notFound } from '@open-mercato/shared/lib/crud/errors'
import { hasFeature } from '@open-mercato/shared/security/features'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { InventoryBalance } from '@open-mercato/core/modules/wms/data/entities'
import {
  PosStateTransition,
  PosTerminal,
  PosTransaction,
  PosTransactionLine,
  type PosTransactionStatus,
} from '../data/entities'
import { recalculateCart } from '../lib/cart'
import { assertTransition, PosTransitionError } from '../lib/stateMachine'
import { evaluateStock, type StockEvaluation } from '../lib/stockPolicy'

export const POS_STOCK_APPROVAL_FEATURE = 'soanas.pos.approval.manager'
export const POS_DISCOUNT_FEATURE = 'soanas.pos.discount.grant'
export const POS_DISCOUNT_APPROVAL_FEATURE = 'soanas.pos.discount.approve'

/** Cart-level discounts above this share of the cart need an approver feature. */
export const POS_DISCOUNT_APPROVAL_THRESHOLD_PERCENT = 20n

export function forkEm(ctx: CommandRuntimeContext): EntityManager {
  return (ctx.container.resolve('em') as EntityManager).fork()
}

export function authFeatures(ctx: CommandRuntimeContext): string[] {
  const raw = ctx.auth?.features
  if (!Array.isArray(raw)) return []
  return raw.filter((value): value is string => typeof value === 'string')
}

export function callerHasFeature(ctx: CommandRuntimeContext, feature: string): boolean {
  if (ctx.systemActor) return true
  return hasFeature(authFeatures(ctx), feature)
}

export async function loadTerminalOrThrow(
  em: EntityManager,
  scope: { id: string; tenantId: string; organizationId: string },
  options: { requireActive?: boolean } = {},
): Promise<PosTerminal> {
  const terminal = await em.findOne(PosTerminal, {
    id: scope.id,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
    ...(options.requireActive === false ? {} : { status: 'active' }),
  })
  if (!terminal) {
    const { translate } = await resolveTranslations()
    throw notFound(translate('soanas_pos.errors.terminal_not_found', 'POS terminal not found'))
  }
  return terminal
}

/**
 * Loads the transaction with a write lock so two operators (or a retry racing the original
 * request) cannot complete the same sale twice. Drivers without row locks fall back to a
 * plain read; the state machine still rejects illegal transitions.
 */
export async function loadTransactionForUpdate(
  em: EntityManager,
  scope: { transactionId: string; tenantId: string; organizationId: string },
): Promise<PosTransaction> {
  const transaction = await em.findOne(
    PosTransaction,
    {
      id: scope.transactionId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    { lockMode: LockMode.PESSIMISTIC_WRITE },
  )
  if (!transaction) {
    const { translate } = await resolveTranslations()
    throw notFound(translate('soanas_pos.errors.transaction_not_found', 'POS transaction not found'))
  }
  return transaction
}

export async function loadLines(em: EntityManager, transaction: PosTransaction): Promise<PosTransactionLine[]> {
  const lines = await em.find(PosTransactionLine, {
    transactionId: transaction.id,
    tenantId: transaction.tenantId,
  })
  return lines.sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * Server-side recalculation (never trust browser totals). The cart-level discount is the
 * part of `discountTotalCents` that is not attributable to any line.
 */
export async function recalculateTransactionTotals(
  em: EntityManager,
  transaction: PosTransaction,
  options: { cartDiscountCents?: bigint } = {},
): Promise<PosTransactionLine[]> {
  const lines = await loadLines(em, transaction)
  const cartDiscountCents = options.cartDiscountCents ?? currentCartDiscountCents(transaction, lines)
  const totals = recalculateCart(
    lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      discountAmountCents: line.discountAmountCents,
      surchargeAmountCents: line.surchargeAmountCents,
      taxAmountCents: line.taxAmountCents,
    })),
    { amountCents: cartDiscountCents },
  )
  for (const lineTotals of totals.lines) {
    const line = lines.find((candidate) => candidate.id === lineTotals.id)
    if (!line) continue
    line.discountAmountCents = lineTotals.discountAmountCents.toString()
    line.lineTotalCents = lineTotals.lineTotalCents.toString()
    line.updatedAt = new Date()
  }
  transaction.subtotalCents = totals.subtotalCents.toString()
  transaction.discountTotalCents = totals.discountTotalCents.toString()
  transaction.surchargeTotalCents = totals.surchargeTotalCents.toString()
  transaction.taxTotalCents = totals.taxTotalCents.toString()
  transaction.grandTotalCents = totals.grandTotalCents.toString()
  transaction.updatedAt = new Date()
  return lines
}

/** Discount recorded on the cart itself = total discount minus the sum of line discounts. */
export function currentCartDiscountCents(
  transaction: PosTransaction,
  lines: PosTransactionLine[],
): bigint {
  const lineDiscounts = lines.reduce((sum, line) => sum + BigInt(line.discountAmountCents), 0n)
  const total = BigInt(transaction.discountTotalCents)
  const cartPart = total - lineDiscounts
  return cartPart > 0n ? cartPart : 0n
}

export async function transitionTo(
  em: EntityManager,
  transaction: PosTransaction,
  to: PosTransactionStatus,
  args: { trigger: string; actorId?: string | null; metadata?: Record<string, unknown> | null },
): Promise<void> {
  const from = transaction.status
  try {
    assertTransition(from, to)
  } catch (err) {
    if (err instanceof PosTransitionError) {
      const { translate } = await resolveTranslations()
      throw badRequest(
        `${translate('soanas_pos.errors.invalid_transition', 'Illegal POS transaction transition')}: ${from} -> ${to}`,
      )
    }
    throw err
  }
  transaction.status = to
  transaction.updatedAt = new Date()
  em.persist(
    em.create(PosStateTransition, {
      transactionId: transaction.id,
      tenantId: transaction.tenantId,
      fromState: from,
      toState: to,
      trigger: args.trigger,
      actorId: args.actorId ?? null,
      correlationId: transaction.correlationId,
      metadata: args.metadata ?? null,
      createdAt: new Date(),
    }),
  )
}

const QUANTITY_SCALE = 4

function toScaledQuantity(value: unknown): bigint {
  if (value === null || value === undefined) return 0n
  const raw = String(value).trim()
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return 0n
  const negative = raw.startsWith('-')
  const [whole, fraction = ''] = (negative ? raw.slice(1) : raw).split('.')
  const digits = `${whole}${fraction.padEnd(QUANTITY_SCALE, '0').slice(0, QUANTITY_SCALE)}`
  const magnitude = BigInt(digits)
  return negative ? -magnitude : magnitude
}

function fromScaledQuantity(value: bigint): string {
  const negative = value < 0n
  const digits = (negative ? -value : value).toString().padStart(QUANTITY_SCALE + 1, '0')
  const whole = digits.slice(0, digits.length - QUANTITY_SCALE)
  const fraction = digits.slice(digits.length - QUANTITY_SCALE)
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/**
 * Available quantity for a variant across every location of a warehouse. WMS keeps a
 * generated `quantityAvailable` column, but it is recomputed here from the stored buckets so
 * the helper also works on drivers that do not select generated columns.
 */
export async function resolveAvailableQuantity(
  em: EntityManager,
  args: { tenantId: string; organizationId: string; warehouseId: string; catalogVariantId: string },
): Promise<{ available: string; hasBalances: boolean }> {
  const balances = await em.find(InventoryBalance, {
    tenantId: args.tenantId,
    organizationId: args.organizationId,
    warehouse: args.warehouseId,
    catalogVariantId: args.catalogVariantId,
    deletedAt: null,
  })
  if (!balances.length) return { available: '0', hasBalances: false }
  let total = 0n
  for (const balance of balances) {
    total +=
      toScaledQuantity(balance.quantityOnHand) -
      toScaledQuantity(balance.quantityReserved) -
      toScaledQuantity(balance.quantityAllocated)
  }
  return { available: fromScaledQuantity(total), hasBalances: true }
}

export type StockGuardArgs = {
  ctx: CommandRuntimeContext
  em: EntityManager
  terminal: PosTerminal
  tenantId: string
  organizationId: string
  catalogVariantId?: string | null
  quantity: string
}

/**
 * Enforces the terminal stock policy before a line is sold. BLOCK refuses, WARN requires an
 * approval feature, ALLOW always passes. Without a warehouse or a variant there is nothing
 * to check, so the sale proceeds (services and unmanaged SKUs).
 */
export async function enforceStockPolicy(args: StockGuardArgs): Promise<StockEvaluation | null> {
  const { ctx, em, terminal } = args
  if (!terminal.warehouseId || !args.catalogVariantId) return null
  if (terminal.stockPolicy === 'ALLOW') return null

  const { available, hasBalances } = await resolveAvailableQuantity(em, {
    tenantId: args.tenantId,
    organizationId: args.organizationId,
    warehouseId: terminal.warehouseId,
    catalogVariantId: args.catalogVariantId,
  })
  const evaluation = evaluateStock(hasBalances ? available : '0', args.quantity, terminal.stockPolicy)
  if (evaluation.decision === 'allow') return evaluation

  const { translate } = await resolveTranslations()
  if (evaluation.decision === 'warn') {
    if (callerHasFeature(ctx, POS_STOCK_APPROVAL_FEATURE)) return evaluation
    throw forbidden(
      translate(
        'soanas_pos.errors.stock_warn_approval_required',
        'Selling below the available stock requires a manager approval',
      ),
    )
  }
  throw badRequest(
    `${translate('soanas_pos.errors.stock_not_available', 'STOCK_NOT_AVAILABLE')}: available=${evaluation.available} requested=${evaluation.requested}`,
  )
}
