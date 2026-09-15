import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  {
    id: 'soanas.establishment.created',
    label: 'Fiscal establishment created',
    entity: 'fiscal_establishment',
    category: 'crud',
  },
  {
    id: 'soanas.establishment.updated',
    label: 'Fiscal establishment updated',
    entity: 'fiscal_establishment',
    category: 'crud',
  },
  {
    id: 'soanas.establishment.deleted',
    label: 'Fiscal establishment deleted',
    entity: 'fiscal_establishment',
    category: 'crud',
  },
  {
    id: 'soanas.establishment.activated',
    label: 'Fiscal establishment activated',
    entity: 'fiscal_establishment',
    category: 'custom',
  },
  {
    id: 'soanas.establishment.deactivated',
    label: 'Fiscal establishment deactivated',
    entity: 'fiscal_establishment',
    category: 'custom',
  },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'soanas_establishments',
  events,
})

export const emitSoanasEstablishmentEvent = eventsConfig.emit
export type SoanasEstablishmentEventId = (typeof events)[number]['id']
export default eventsConfig
