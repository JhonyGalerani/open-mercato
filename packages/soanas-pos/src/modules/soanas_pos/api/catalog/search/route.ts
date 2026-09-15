import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  CatalogProductPrice,
  CatalogProductVariant,
} from '@open-mercato/core/modules/catalog/data/entities'
import { posCatalogSearchSchema } from '../../../data/validators'
import { posScopeErrorResponse, resolvePosRequestScope } from '../../utils'

export const metadata = {
  path: '/soanas_pos/catalog/search',
  GET: { requireAuth: true, requireFeatures: ['soanas_pos.catalog.search'] },
}

const itemSchema = z.object({
  variantId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  name: z.string(),
  unitPriceCents: z.string().nullable(),
  currencyCode: z.string().nullable(),
})

function toCents(amount: string | null | undefined): string | null {
  if (amount === null || amount === undefined || amount === '') return null
  const [whole, fraction = ''] = String(amount).split('.')
  const negative = whole.startsWith('-')
  const digits = `${negative ? whole.slice(1) : whole}${fraction.padEnd(2, '0').slice(0, 2)}`
  const cents = BigInt(digits || '0')
  return (negative ? -cents : cents).toString()
}

/**
 * Operator-facing lookup by SKU, barcode or name. Prices come from the catalog price rows
 * so the POS never invents a price client-side.
 */
export async function GET(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const scope = await resolvePosRequestScope(req)
    const url = new URL(req.url)
    const query = posCatalogSearchSchema.parse(Object.fromEntries(url.searchParams.entries()))
    const em = (scope.container.resolve('em') as EntityManager).fork()

    const where: Record<string, unknown> = {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      isActive: true,
      deletedAt: null,
    }
    const term = query.search?.trim()
    if (term) {
      const like = `%${escapeLikePattern(term)}%`
      where.$or = [{ sku: { $ilike: like } }, { barcode: { $ilike: like } }, { name: { $ilike: like } }]
    }

    const [variants, total] = await em.findAndCount(CatalogProductVariant, where, {
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      orderBy: { sku: 'asc' },
      populate: ['product'],
    })

    const variantIds = variants.map((variant) => variant.id)
    const prices = variantIds.length
      ? await em.find(CatalogProductPrice, {
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
          variant: { $in: variantIds },
        })
      : []
    const priceByVariant = new Map<string, CatalogProductPrice>()
    for (const price of prices) {
      const variantId = typeof price.variant === 'string' ? price.variant : price.variant?.id
      if (!variantId || priceByVariant.has(variantId)) continue
      priceByVariant.set(variantId, price)
    }

    return NextResponse.json({
      items: variants.map((variant) => {
        const price = priceByVariant.get(variant.id)
        const product = typeof variant.product === 'string' ? null : variant.product
        return {
          variantId: variant.id,
          productId: product?.id ?? null,
          sku: variant.sku ?? null,
          barcode: variant.barcode ?? null,
          name: variant.name ?? product?.title ?? variant.sku ?? variant.id,
          unitPriceCents: toCents(price?.unitPriceGross ?? price?.unitPriceNet ?? null),
          currencyCode: price?.currencyCode ?? null,
        }
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    })
  } catch (err) {
    const scopeResponse = posScopeErrorResponse(err)
    if (scopeResponse) return scopeResponse
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: translate('soanas_pos.errors.invalid_payload', 'Invalid payload'), details: err.flatten() },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: translate('soanas_pos.errors.catalog_search_failed', 'Failed to search the catalog') },
      { status: 500 },
    )
  }
}

export const openApi = {
  tag: 'Soanas POS',
  summary: 'POS catalog search',
  methods: {
    GET: {
      summary: 'Search sellable variants by SKU, barcode or name',
      query: posCatalogSearchSchema,
      responses: [
        {
          status: 200,
          schema: z.object({
            items: z.array(itemSchema),
            total: z.number().int().nonnegative(),
            page: z.number().int().positive(),
            pageSize: z.number().int().positive(),
          }),
        },
      ],
    },
  },
}
