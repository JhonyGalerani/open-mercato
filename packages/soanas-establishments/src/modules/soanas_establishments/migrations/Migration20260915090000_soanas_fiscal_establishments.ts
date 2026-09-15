import { Migration } from '@mikro-orm/migrations'

/**
 * EST-001 — FiscalEstablishment table for Soanas Brazilian establishments.
 */
export class Migration20260915090000_soanas_fiscal_establishments extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "soanas_fiscal_establishments" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "legal_name" text not null,
        "trade_name" text null,
        "cnpj" text not null,
        "state_registration" text null,
        "municipal_registration" text null,
        "primary_cnae" text null,
        "secondary_cnaes" jsonb null,
        "crt" text null,
        "special_regime" text null,
        "ibge_city_code" text null,
        "uf" text null,
        "address_line1" text null,
        "address_line2" text null,
        "address_number" text null,
        "address_district" text null,
        "city" text null,
        "zip" text null,
        "phone" text null,
        "fiscal_email" text null,
        "accountant_name" text null,
        "accountant_crc" text null,
        "fiscal_environment" text not null default 'homologation',
        "default_warehouse_id" uuid null,
        "default_price_kind" text null,
        "default_sales_channel_id" uuid null,
        "nfce_series" text null,
        "nfe_series" text null,
        "nfce_number" int not null default 0,
        "nfe_number" int not null default 0,
        "nfce_csc_id" text null,
        "certificate_id" uuid null,
        "timezone" text not null default 'America/Sao_Paulo',
        "currency_code" text not null default 'BRL',
        "policies" jsonb null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "soanas_fiscal_establishments_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "soanas_fiscal_establishments_scope_idx" on "soanas_fiscal_establishments" ("organization_id", "tenant_id");`,
    )
    this.addSql(
      `create unique index if not exists "soanas_fiscal_establishments_org_tenant_unique" on "soanas_fiscal_establishments" ("organization_id", "tenant_id") where "deleted_at" is null;`,
    )
    this.addSql(
      `create unique index if not exists "soanas_fiscal_establishments_cnpj_tenant_unique" on "soanas_fiscal_establishments" ("cnpj", "tenant_id") where "deleted_at" is null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "soanas_fiscal_establishments" cascade;`)
  }
}
