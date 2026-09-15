import { Migration } from '@mikro-orm/migrations'

export class Migration20260915120000_soanas_cash_v2 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "soanas_cash_registers" add column if not exists "blind_closing" boolean not null default false;`)
    this.addSql(`alter table "soanas_cash_registers" add column if not exists "withdrawal_limit_without_approval_cents" bigint null;`)
    this.addSql(`alter table "soanas_cash_registers" add column if not exists "supply_limit_without_approval_cents" bigint null;`)
    this.addSql(`alter table "soanas_cash_registers" add column if not exists "discrepancy_tolerance_cents" bigint not null default 0;`)
    this.addSql(`alter table "soanas_cash_registers" add column if not exists "expected_opening_float_cents" bigint null;`)

    this.addSql(`alter table "soanas_cash_sessions" add column if not exists "notes" text null;`)
    this.addSql(`alter table "soanas_cash_sessions" add column if not exists "closing_blind" boolean not null default false;`)

    this.addSql(`alter table "soanas_cash_movements" add column if not exists "origin" text null;`)
    this.addSql(`alter table "soanas_cash_movements" add column if not exists "pos_transaction_id" uuid null;`)
    this.addSql(`alter table "soanas_cash_movements" add column if not exists "sales_order_id" uuid null;`)
    this.addSql(`alter table "soanas_cash_movements" add column if not exists "payment_tender_id" uuid null;`)
    this.addSql(`alter table "soanas_cash_movements" add column if not exists "receipt_payload" jsonb null;`)
    this.addSql(`create index if not exists "soanas_cash_movements_pos_transaction_idx" on "soanas_cash_movements" ("tenant_id", "pos_transaction_id");`)

    this.addSql(`create unique index if not exists "soanas_cash_sessions_register_open_unique" on "soanas_cash_sessions" ("register_id") where "deleted_at" is null and "status" in ('opening', 'open', 'closing');`)
    this.addSql(`create unique index if not exists "soanas_cash_sessions_idempotency_unique" on "soanas_cash_sessions" ("tenant_id", "idempotency_key") where "idempotency_key" is not null;`)
    this.addSql(`create unique index if not exists "soanas_cash_drawers_register_code_unique" on "soanas_cash_drawers" ("register_id", "code") where "deleted_at" is null;`)

    this.addSql(`
      create table if not exists "soanas_cash_counts" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "session_id" uuid not null,
        "register_id" uuid not null,
        "kind" text not null,
        "denominations" jsonb null,
        "total_counted_cents" bigint not null,
        "operator_user_id" uuid not null,
        "notes" text null,
        "blind_mode" boolean not null default false,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "soanas_cash_counts_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_cash_counts_scope_idx" on "soanas_cash_counts" ("organization_id", "tenant_id");`)
    this.addSql(`create index if not exists "soanas_cash_counts_session_idx" on "soanas_cash_counts" ("session_id", "created_at");`)

    this.addSql(`
      create table if not exists "soanas_cash_reconciliations" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "session_id" uuid not null,
        "count_id" uuid null,
        "expected_cash_cents" bigint not null,
        "counted_cash_cents" bigint not null,
        "discrepancy_cents" bigint not null,
        "tolerance_cents" bigint not null default 0,
        "status" text not null,
        "reason" text null,
        "approval_id" uuid null,
        "operator_user_id" uuid not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "soanas_cash_reconciliations_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_cash_reconciliations_scope_idx" on "soanas_cash_reconciliations" ("organization_id", "tenant_id");`)
    this.addSql(`create index if not exists "soanas_cash_reconciliations_session_idx" on "soanas_cash_reconciliations" ("session_id", "created_at");`)

    this.addSql(`
      create table if not exists "soanas_cash_approvals" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "session_id" uuid null,
        "movement_id" uuid null,
        "reconciliation_id" uuid null,
        "kind" text not null,
        "requester_user_id" uuid not null,
        "approver_user_id" uuid null,
        "status" text not null default 'pending',
        "reason" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "soanas_cash_approvals_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_cash_approvals_scope_idx" on "soanas_cash_approvals" ("organization_id", "tenant_id");`)
    this.addSql(`create index if not exists "soanas_cash_approvals_session_idx" on "soanas_cash_approvals" ("session_id", "created_at");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "soanas_cash_approvals" cascade;`)
    this.addSql(`drop table if exists "soanas_cash_reconciliations" cascade;`)
    this.addSql(`drop table if exists "soanas_cash_counts" cascade;`)

    this.addSql(`drop index if exists "soanas_cash_drawers_register_code_unique";`)
    this.addSql(`drop index if exists "soanas_cash_sessions_idempotency_unique";`)
    this.addSql(`drop index if exists "soanas_cash_sessions_register_open_unique";`)
    this.addSql(`drop index if exists "soanas_cash_movements_pos_transaction_idx";`)

    this.addSql(`alter table "soanas_cash_movements" drop column if exists "receipt_payload";`)
    this.addSql(`alter table "soanas_cash_movements" drop column if exists "payment_tender_id";`)
    this.addSql(`alter table "soanas_cash_movements" drop column if exists "sales_order_id";`)
    this.addSql(`alter table "soanas_cash_movements" drop column if exists "pos_transaction_id";`)
    this.addSql(`alter table "soanas_cash_movements" drop column if exists "origin";`)

    this.addSql(`alter table "soanas_cash_sessions" drop column if exists "closing_blind";`)
    this.addSql(`alter table "soanas_cash_sessions" drop column if exists "notes";`)

    this.addSql(`alter table "soanas_cash_registers" drop column if exists "expected_opening_float_cents";`)
    this.addSql(`alter table "soanas_cash_registers" drop column if exists "discrepancy_tolerance_cents";`)
    this.addSql(`alter table "soanas_cash_registers" drop column if exists "supply_limit_without_approval_cents";`)
    this.addSql(`alter table "soanas_cash_registers" drop column if exists "withdrawal_limit_without_approval_cents";`)
    this.addSql(`alter table "soanas_cash_registers" drop column if exists "blind_closing";`)
  }
}
