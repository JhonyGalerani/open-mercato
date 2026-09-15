import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'soanas.cash.session.opened', label: 'Cash session opened', entity: 'cash_session', category: 'custom' },
  { id: 'soanas.cash.session.closed', label: 'Cash session closed', entity: 'cash_session', category: 'custom' },
  { id: 'soanas.cash.withdrawal.created', label: 'Cash withdrawal created', entity: 'cash_movement', category: 'custom' },
  { id: 'soanas.cash.supply.created', label: 'Cash supply created', entity: 'cash_movement', category: 'custom' },
  { id: 'soanas.cash.discrepancy.detected', label: 'Cash discrepancy detected', entity: 'cash_session', category: 'custom' },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'soanas_cash', events })
export const emitSoanasCashEvent = eventsConfig.emit
export type SoanasCashEventId = (typeof events)[number]['id']
export default eventsConfig
