export type SoanasErrorBody = {
  errorCode: string
  message: string
  correlationId?: string
  retryable: boolean
  operatorAction?: string
}

export function buildSoanasError(input: SoanasErrorBody): SoanasErrorBody {
  return {
    errorCode: input.errorCode,
    message: input.message,
    correlationId: input.correlationId,
    retryable: input.retryable,
    operatorAction: input.operatorAction,
  }
}
