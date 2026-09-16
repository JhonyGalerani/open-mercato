import type { PosRecoveryStep } from '../data/entities'

export type CompleteSaleStep = 'sales' | 'wms' | 'cash' | 'complete'

export const COMPLETE_SALE_STEP_ORDER: PosRecoveryStep[] = ['validate', 'sales', 'wms', 'cash', 'complete']

export type CompleteSaleSkipReason =
  | 'already_done'
  | 'no_warehouse'
  | 'no_lines'
  | 'no_cash_session'
  | 'no_cash_tender'

export type CompleteSaleSnapshot = {
  /** Checkpoint persisted by the previous attempt, if any (ADR-007). */
  lastStep?: PosRecoveryStep | null
  salesOrderId?: string | null
  wmsMovementId?: string | null
  cashMovementId?: string | null
}

export type CompleteSalePlanInput = {
  recovery?: CompleteSaleSnapshot | null
  /** Order id already stored on the transaction itself (source of truth over recovery). */
  salesOrderId?: string | null
  warehouseId?: string | null
  lineCount: number
  cashSessionId?: string | null
  hasCashTender: boolean
}

export type CompleteSalePlan = {
  steps: CompleteSaleStep[]
  skipped: { step: CompleteSaleStep; reason: CompleteSaleSkipReason }[]
  /**
   * The `sales` step covers order creation *and* payment registration. An attempt that
   * created the order but died before the payment replays the step with this flag off.
   */
  createSalesOrder: boolean
}

function stepIndex(step: PosRecoveryStep | null | undefined): number {
  if (!step) return 0
  const index = COMPLETE_SALE_STEP_ORDER.indexOf(step)
  return index < 0 ? 0 : index
}

/**
 * Pure planner for `completePosSale`. Given what the previous attempt managed to persist it
 * decides which saga steps still have to run, so a retry never duplicates a SalesOrder, an
 * inventory movement or a cash movement.
 */
export function planCompleteSale(input: CompleteSalePlanInput): CompleteSalePlan {
  const recovery = input.recovery ?? null
  const checkpoint = stepIndex(recovery?.lastStep ?? null)
  const steps: CompleteSaleStep[] = []
  const skipped: { step: CompleteSaleStep; reason: CompleteSaleSkipReason }[] = []

  const knownSalesOrderId = input.salesOrderId ?? recovery?.salesOrderId ?? null
  const salesDone = checkpoint >= stepIndex('sales')
  if (salesDone) skipped.push({ step: 'sales', reason: 'already_done' })
  else steps.push('sales')

  if (!input.warehouseId) {
    skipped.push({ step: 'wms', reason: 'no_warehouse' })
  } else if (input.lineCount <= 0) {
    skipped.push({ step: 'wms', reason: 'no_lines' })
  } else if (checkpoint >= stepIndex('wms')) {
    // Only lastStep=wms means every allocation checkpoint finished. A partial
    // wmsMovementId alone must NOT skip remaining location deductions.
    skipped.push({ step: 'wms', reason: 'already_done' })
  } else {
    steps.push('wms')
  }

  if (!input.cashSessionId) {
    skipped.push({ step: 'cash', reason: 'no_cash_session' })
  } else if (!input.hasCashTender) {
    skipped.push({ step: 'cash', reason: 'no_cash_tender' })
  } else if (recovery?.cashMovementId || checkpoint >= stepIndex('cash')) {
    skipped.push({ step: 'cash', reason: 'already_done' })
  } else {
    steps.push('cash')
  }

  if (checkpoint >= stepIndex('complete')) skipped.push({ step: 'complete', reason: 'already_done' })
  else steps.push('complete')

  return { steps, skipped, createSalesOrder: !salesDone && !knownSalesOrderId }
}

export function planIncludes(plan: CompleteSalePlan, step: CompleteSaleStep): boolean {
  return plan.steps.includes(step)
}
