import type { PosAllocationStep } from '../data/entities'
import type { LocationDeduction } from './stockAllocation'

export function buildAllocationSteps(args: {
  transactionId: string
  salesOrderId: string
  catalogVariantId: string
  deductions: LocationDeduction[]
}): PosAllocationStep[] {
  return args.deductions.map((deduction, index) => ({
    catalogVariantId: args.catalogVariantId,
    locationId: deduction.locationId,
    lotId: deduction.lotId,
    serialNumber: deduction.serialNumber,
    plannedQuantity: deduction.quantity,
    movementId: null,
    status: 'PENDING' as const,
    idempotencyKey: [
      'pos-wms',
      args.transactionId,
      args.salesOrderId,
      args.catalogVariantId,
      deduction.locationId,
      deduction.lotId ?? '',
      deduction.serialNumber ?? '',
      deduction.quantity,
      String(index),
    ].join(':'),
  }))
}

export function allocationPlanComplete(plan: PosAllocationStep[] | null | undefined): boolean {
  if (!plan || plan.length === 0) return false
  return plan.every((step) => step.status === 'COMPLETED')
}

export function pendingAllocationSteps(plan: PosAllocationStep[] | null | undefined): PosAllocationStep[] {
  return (plan ?? []).filter((step) => step.status !== 'COMPLETED')
}
