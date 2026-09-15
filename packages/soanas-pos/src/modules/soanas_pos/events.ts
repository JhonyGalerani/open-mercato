import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'soanas.pos.transaction.created', label: 'POS transaction created', entity: 'pos_transaction', category: 'custom' },
  { id: 'soanas.pos.transaction.checked_out', label: 'POS transaction checked out', entity: 'pos_transaction', category: 'custom' },
  { id: 'soanas.pos.tender.added', label: 'POS tender added', entity: 'payment_tender', category: 'custom' },
  { id: 'soanas.pos.transaction.completed', label: 'POS transaction completed', entity: 'pos_transaction', category: 'custom' },
  { id: 'soanas.pos.transaction.failed', label: 'POS transaction failed mid-completion', entity: 'pos_transaction', category: 'custom' },
  { id: 'soanas.pos.transaction.cancelled', label: 'POS transaction cancelled', entity: 'pos_transaction', category: 'custom' },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'soanas_pos', events })
export const emitSoanasPosEvent = eventsConfig.emit
export type SoanasPosEventId = (typeof events)[number]['id']
export default eventsConfig
