import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'soanas.payments.pix.created', label: 'Pix charge created', entity: 'pix_charge', category: 'custom' },
  { id: 'soanas.payments.pix.paid', label: 'Pix charge paid', entity: 'pix_charge', category: 'custom' },
  { id: 'soanas.payments.pix.expired', label: 'Pix charge expired', entity: 'pix_charge', category: 'custom' },
  { id: 'soanas.payments.pix.cancelled', label: 'Pix charge cancelled', entity: 'pix_charge', category: 'custom' },
  { id: 'soanas.payments.pix.refunded', label: 'Pix charge refunded', entity: 'pix_charge', category: 'custom' },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'soanas_payments_br', events })
export const emitSoanasPaymentsBrEvent = eventsConfig.emit
export type SoanasPaymentsBrEventId = (typeof events)[number]['id']
export default eventsConfig
