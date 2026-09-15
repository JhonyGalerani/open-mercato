import { Migration } from '@mikro-orm/migrations'

export class Migration20260915130000_soanas_pos extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "soanas_pos_terminals" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "establishment_id" uuid null,
        "code" text not null,
        "name" text not null,
        "warehouse_id" uuid null,
        "sales_channel_id" uuid null,
        "price_kind_id" uuid null,
        "cash_register_id" uuid null,
        "device_id" uuid null,
        "stock_policy" text not null default 'BLOCK',
        "status" text not null default 'active',
        "client_version" text null,
        "last_seen_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "soanas_pos_terminals_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_pos_terminals_scope_idx" on "soanas_pos_terminals" ("organization_id", "tenant_id");`)
    this.addSql(`create unique index if not exists "soanas_pos_terminals_code_scope_unique" on "soanas_pos_terminals" ("tenant_id", "organization_id", "code") where "deleted_at" is null;`)

    this.addSql(`
      create table if not exists "soanas_pos_transactions" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "establishment_id" uuid null,
        "terminal_id" uuid not null,
        "cash_session_id" uuid null,
        "operator_user_id" uuid not null,
        "customer_id" uuid null,
        "sales_order_id" uuid null,
        "status" text not null default 'DRAFT',
        "currency_code" text not null default 'BRL',
        "subtotal_cents" bigint not null default 0,
        "discount_total_cents" bigint not null default 0,
        "surcharge_total_cents" bigint not null default 0,
        "tax_total_cents" bigint not null default 0,
        "grand_total_cents" bigint not null default 0,
        "amount_paid_cents" bigint not null default 0,
        "change_amount_cents" bigint not null default 0,
        "correlation_id" text not null,
        "idempotency_key" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "completed_at" timestamptz null,
        "cancelled_at" timestamptz null,
        "deleted_at" timestamptz null,
        constraint "soanas_pos_transactions_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_pos_transactions_scope_idx" on "soanas_pos_transactions" ("organization_id", "tenant_id");`)
    this.addSql(`create index if not exists "soanas_pos_transactions_terminal_status_idx" on "soanas_pos_transactions" ("terminal_id", "status");`)
    this.addSql(`create index if not exists "soanas_pos_transactions_session_idx" on "soanas_pos_transactions" ("cash_session_id", "created_at");`)
    this.addSql(`create unique index if not exists "soanas_pos_transactions_idempotency_unique" on "soanas_pos_transactions" ("tenant_id", "idempotency_key");`)

    this.addSql(`
      create table if not exists "soanas_pos_transaction_lines" (
        "id" uuid not null default gen_random_uuid(),
        "transaction_id" uuid not null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "catalog_product_id" uuid null,
        "catalog_variant_id" uuid null,
        "sku" text not null,
        "name_snapshot" text not null,
        "quantity" text not null,
        "unit_price_cents" bigint not null,
        "original_unit_price_cents" bigint not null,
        "discount_amount_cents" bigint not null default 0,
        "surcharge_amount_cents" bigint not null default 0,
        "tax_amount_cents" bigint not null default 0,
        "line_total_cents" bigint not null default 0,
        "unit" text null,
        "metadata" jsonb null,
        "sort_order" int not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "soanas_pos_transaction_lines_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_pos_transaction_lines_tx_idx" on "soanas_pos_transaction_lines" ("transaction_id", "sort_order");`)
    this.addSql(`create index if not exists "soanas_pos_transaction_lines_scope_idx" on "soanas_pos_transaction_lines" ("organization_id", "tenant_id");`)

    this.addSql(`
      create table if not exists "soanas_pos_payment_tenders" (
        "id" uuid not null default gen_random_uuid(),
        "pos_transaction_id" uuid not null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "type" text not null,
        "amount_applied_cents" bigint not null,
        "amount_received_cents" bigint null,
        "change_amount_cents" bigint null,
        "status" text not null default 'captured',
        "provider" text null,
        "external_transaction_id" text null,
        "metadata" jsonb null,
        "idempotency_key" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "soanas_pos_payment_tenders_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_pos_payment_tenders_tx_idx" on "soanas_pos_payment_tenders" ("pos_transaction_id", "created_at");`)
    this.addSql(`create index if not exists "soanas_pos_payment_tenders_scope_idx" on "soanas_pos_payment_tenders" ("organization_id", "tenant_id");`)
    this.addSql(`create unique index if not exists "soanas_pos_payment_tenders_idempotency_unique" on "soanas_pos_payment_tenders" ("tenant_id", "idempotency_key");`)

    this.addSql(`
      create table if not exists "soanas_pos_state_transitions" (
        "id" uuid not null default gen_random_uuid(),
        "transaction_id" uuid not null,
        "tenant_id" uuid not null,
        "from_state" text not null,
        "to_state" text not null,
        "trigger" text not null,
        "actor_id" uuid null,
        "correlation_id" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        constraint "soanas_pos_state_transitions_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_pos_state_transitions_tx_idx" on "soanas_pos_state_transitions" ("transaction_id", "created_at");`)

    this.addSql(`
      create table if not exists "soanas_pos_recovery_states" (
        "id" uuid not null default gen_random_uuid(),
        "transaction_id" uuid not null,
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "last_step" text not null default 'validate',
        "sales_order_id" uuid null,
        "wms_movement_id" uuid null,
        "cash_movement_id" uuid null,
        "error_code" text null,
        "error_message" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "soanas_pos_recovery_states_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_pos_recovery_states_scope_idx" on "soanas_pos_recovery_states" ("organization_id", "tenant_id");`)
    this.addSql(`create unique index if not exists "soanas_pos_recovery_states_tx_unique" on "soanas_pos_recovery_states" ("transaction_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "soanas_pos_recovery_states";`)
    this.addSql(`drop table if exists "soanas_pos_state_transitions";`)
    this.addSql(`drop table if exists "soanas_pos_payment_tenders";`)
    this.addSql(`drop table if exists "soanas_pos_transaction_lines";`)
    this.addSql(`drop table if exists "soanas_pos_transactions";`)
    this.addSql(`drop table if exists "soanas_pos_terminals";`)
  }
}
