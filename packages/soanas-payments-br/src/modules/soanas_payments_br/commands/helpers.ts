import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { PixProvider } from '../lib/pixProvider'
import { PixCharge } from '../data/entities'
import { PIX_PROVIDER_DI_KEY } from '../di'

export function forkEm(ctx: CommandRuntimeContext): EntityManager {
  return (ctx.container.resolve('em') as EntityManager).fork()
}

export function resolvePixProvider(ctx: CommandRuntimeContext): PixProvider {
  return ctx.container.resolve(PIX_PROVIDER_DI_KEY) as PixProvider
}

export async function loadPixChargeOrThrow(
  em: EntityManager,
  scope: { tenantId: string; txid: string },
): Promise<PixCharge> {
  const charge = await em.findOne(PixCharge, {
    tenantId: scope.tenantId,
    txid: scope.txid,
    deletedAt: null,
  })
  if (!charge) {
    const { translate } = await resolveTranslations()
    throw notFound(translate('soanas_payments_br.errors.charge_not_found', 'Pix charge not found'))
  }
  return charge
}
