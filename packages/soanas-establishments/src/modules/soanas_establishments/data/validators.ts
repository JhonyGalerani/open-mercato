import { z } from 'zod'
import { isAcceptableCnpj, normalizeCnpj } from '@open-mercato/soanas-core/lib/cnpj'

const cnpjSchema = z
  .string()
  .trim()
  .min(14)
  .max(18)
  .transform((value) => normalizeCnpj(value))
  .refine((value) => isAcceptableCnpj(value), { message: 'Invalid CNPJ' })

export const fiscalEnvironmentSchema = z.enum(['homologation', 'production'])

export const establishmentPoliciesSchema = z
  .object({
    allowNegativeStock: z.boolean().optional(),
    cash: z.record(z.string(), z.unknown()).optional(),
    discounts: z.record(z.string(), z.unknown()).optional(),
    cancellations: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .optional()
  .nullable()

export const fiscalEstablishmentCreateSchema = z
  .object({
    organizationId: z.string().uuid(),
    tenantId: z.string().uuid(),
    legalName: z.string().trim().min(1).max(255),
    tradeName: z.string().trim().max(255).nullish(),
    cnpj: cnpjSchema,
    stateRegistration: z.string().trim().max(32).nullish(),
    municipalRegistration: z.string().trim().max(32).nullish(),
    primaryCnae: z.string().trim().max(16).nullish(),
    secondaryCnaes: z.array(z.string().trim().max(16)).max(20).nullish(),
    crt: z.string().trim().max(8).nullish(),
    specialRegime: z.string().trim().max(64).nullish(),
    ibgeCityCode: z.string().trim().max(16).nullish(),
    uf: z.string().trim().length(2).nullish(),
    addressLine1: z.string().trim().max(255).nullish(),
    addressLine2: z.string().trim().max(255).nullish(),
    addressNumber: z.string().trim().max(32).nullish(),
    addressDistrict: z.string().trim().max(128).nullish(),
    city: z.string().trim().max(128).nullish(),
    zip: z.string().trim().max(16).nullish(),
    phone: z.string().trim().max(32).nullish(),
    fiscalEmail: z.string().trim().email().max(255).nullish(),
    accountantName: z.string().trim().max(255).nullish(),
    accountantCrc: z.string().trim().max(64).nullish(),
    fiscalEnvironment: fiscalEnvironmentSchema.optional(),
    defaultWarehouseId: z.string().uuid().nullish(),
    defaultPriceKind: z.string().trim().max(64).nullish(),
    defaultSalesChannelId: z.string().uuid().nullish(),
    nfceSeries: z.string().trim().max(8).nullish(),
    nfeSeries: z.string().trim().max(8).nullish(),
    nfceNumber: z.number().int().min(0).optional(),
    nfeNumber: z.number().int().min(0).optional(),
    nfceCscId: z.string().trim().max(64).nullish(),
    certificateId: z.string().uuid().nullish(),
    timezone: z.string().trim().max(64).optional(),
    currencyCode: z.string().trim().length(3).optional(),
    policies: establishmentPoliciesSchema,
    isActive: z.boolean().optional(),
  })
  .strict()

export const fiscalEstablishmentUpdateSchema = fiscalEstablishmentCreateSchema
  .partial()
  .extend({
    id: z.string().uuid(),
    organizationId: z.string().uuid().optional(),
    tenantId: z.string().uuid().optional(),
  })
  .strict()

export const fiscalEstablishmentDeleteSchema = z
  .object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid().optional(),
  })
  .strict()

export type FiscalEstablishmentCreateInput = z.infer<typeof fiscalEstablishmentCreateSchema>
export type FiscalEstablishmentUpdateInput = z.infer<typeof fiscalEstablishmentUpdateSchema>
export type FiscalEstablishmentDeleteInput = z.infer<typeof fiscalEstablishmentDeleteSchema>
