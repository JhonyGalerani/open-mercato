import { Migration } from '@mikro-orm/migrations'

export class Migration20260916070000_soanas_payments_pix extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "soanas_payments_br_pix_charges" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "terminal_id" uuid null,
        "pos_transaction_id" uuid null,
        "sales_order_id" uuid null,
        "txid" text not null,
        "status" text not null default 'CREATED',
        "amount_cents" bigint not null,
        "qr_code" text not null,
        "copia_e_cola" text not null,
        "expires_at" timestamptz not null,
        "e2e_id" text null,
        "paid_at" timestamptz null,
        "provider" text not null default 'mock',
        "idempotency_key" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "soanas_payments_br_pix_charges_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_payments_br_pix_charges_scope_idx" on "soanas_payments_br_pix_charges" ("organization_id", "tenant_id");`)
    this.addSql(`create index if not exists "soanas_payments_br_pix_charges_status_idx" on "soanas_payments_br_pix_charges" ("tenant_id", "status");`)
    this.addSql(`create index if not exists "soanas_payments_br_pix_charges_pos_tx_idx" on "soanas_payments_br_pix_charges" ("pos_transaction_id");`)
    this.addSql(`create unique index if not exists "soanas_payments_br_pix_charges_txid_unique" on "soanas_payments_br_pix_charges" ("tenant_id", "txid") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "soanas_payments_br_pix_charges";`)
  }
}
