import { buildSoanasError, type SoanasErrorBody } from '@open-mercato/soanas-core/lib/errors'

export type PosErrorCode =
  | 'POS_TERMINAL_NOT_FOUND'
  | 'POS_TRANSACTION_NOT_FOUND'
  | 'POS_TRANSACTION_NOT_EDITABLE'
  | 'POS_INVALID_TRANSITION'
  | 'POS_EMPTY_CART'
  | 'POS_NOT_FULLY_PAID'
  | 'POS_DISCOUNT_FORBIDDEN'
  | 'POS_STOCK_NOT_AVAILABLE'
  | 'POS_STOCK_WARN_APPROVAL_REQUIRED'
  | 'POS_COMPLETE_FAILED'
  | 'POS_COMPLETED_NOT_CANCELLABLE'

export function posError(input: {
  errorCode: PosErrorCode
  message: string
  correlationId?: string
  retryable?: boolean
  operatorAction?: string
}): SoanasErrorBody {
  return buildSoanasError({
    errorCode: input.errorCode,
    message: input.message,
    correlationId: input.correlationId,
    retryable: input.retryable ?? false,
    operatorAction: input.operatorAction,
  })
}
