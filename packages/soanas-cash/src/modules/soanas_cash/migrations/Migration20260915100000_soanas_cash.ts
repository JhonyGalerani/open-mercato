import { Migration } from '@mikro-orm/migrations'

export class Migration20260915100000_soanas_cash extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "soanas_cash_registers" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "establishment_id" uuid null,
        "code" text not null,
        "name" text not null,
        "terminal_id" uuid null,
        "drawer_id" uuid null,
        "warehouse_id" uuid null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "soanas_cash_registers_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_cash_registers_scope_idx" on "soanas_cash_registers" ("organization_id", "tenant_id");`)
    this.addSql(`create unique index if not exists "soanas_cash_registers_code_scope_unique" on "soanas_cash_registers" ("tenant_id", "organization_id", "code") where "deleted_at" is null;`)

    this.addSql(`
      create table if not exists "soanas_cash_drawers" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "register_id" uuid not null,
        "code" text not null,
        "name" text null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "soanas_cash_drawers_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_cash_drawers_scope_idx" on "soanas_cash_drawers" ("organization_id", "tenant_id");`)

    this.addSql(`
      create table if not exists "soanas_cash_sessions" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "establishment_id" uuid null,
        "register_id" uuid not null,
        "terminal_id" uuid null,
        "operator_user_id" uuid not null,
        "status" text not null default 'open',
        "opening_float_cents" bigint not null,
        "opening_denominations" jsonb null,
        "opened_at_server" timestamptz not null default now(),
        "opened_at_local" timestamptz null,
        "closed_at_server" timestamptz null,
        "closed_at_local" timestamptz null,
        "idempotency_key" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "soanas_cash_sessions_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_cash_sessions_scope_idx" on "soanas_cash_sessions" ("organization_id", "tenant_id");`)
    this.addSql(`create index if not exists "soanas_cash_sessions_register_status_idx" on "soanas_cash_sessions" ("register_id", "status");`)

    this.addSql(`
      create table if not exists "soanas_cash_movements" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "session_id" uuid not null,
        "register_id" uuid not null,
        "type" text not null,
        "amount_cents" bigint not null,
        "status" text not null default 'confirmed',
        "reason_code" text null,
        "reason_detail" text null,
        "destination" text null,
        "receiver_name" text null,
        "operator_user_id" uuid not null,
        "approver_user_id" uuid null,
        "terminal_id" uuid null,
        "denominations" jsonb null,
        "reverses_movement_id" uuid null,
        "idempotency_key" text not null,
        "sync_status" text not null default 'pending',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "soanas_cash_movements_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "soanas_cash_movements_session_idx" on "soanas_cash_movements" ("session_id", "created_at");`)
    this.addSql(`create index if not exists "soanas_cash_movements_scope_idx" on "soanas_cash_movements" ("organization_id", "tenant_id");`)
    this.addSql(`create unique index if not exists "soanas_cash_movements_idempotency_unique" on "soanas_cash_movements" ("tenant_id", "idempotency_key");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "soanas_cash_movements" cascade;`)
    this.addSql(`drop table if exists "soanas_cash_sessions" cascade;`)
    this.addSql(`drop table if exists "soanas_cash_drawers" cascade;`)
    this.addSql(`drop table if exists "soanas_cash_registers" cascade;`)
  }
}
