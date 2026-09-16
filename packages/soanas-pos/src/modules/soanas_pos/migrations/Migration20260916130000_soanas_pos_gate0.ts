import { Migration } from '@mikro-orm/migrations'

export class Migration20260916130000_soanas_pos_gate0 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "soanas_pos_recovery_states"
        add column if not exists "allocation_plan" jsonb null,
        add column if not exists "wms_movement_ids" jsonb null;
    `)

    this.addSql(`
      create table if not exists "soanas_pos_print_jobs" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "transaction_id" uuid not null,
        "kind" text not null default 'sale_receipt',
        "status" text not null default 'QUEUED',
        "payload" jsonb not null,
        "attempts" int not null default 0,
        "last_error" text null,
        "printer_job_id" text null,
        "idempotency_key" text not null,
        "printed_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "soanas_pos_print_jobs_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "soanas_pos_print_jobs_scope_idx" on "soanas_pos_print_jobs" ("organization_id", "tenant_id");`,
    )
    this.addSql(
      `create index if not exists "soanas_pos_print_jobs_tx_idx" on "soanas_pos_print_jobs" ("transaction_id", "status");`,
    )
    this.addSql(`
      create unique index if not exists "soanas_pos_print_jobs_idempotency_unique"
        on "soanas_pos_print_jobs" ("tenant_id", "idempotency_key")
        where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "soanas_pos_print_jobs";`)
    this.addSql(`
      alter table "soanas_pos_recovery_states"
        drop column if exists "allocation_plan",
        drop column if exists "wms_movement_ids";
    `)
  }
}
