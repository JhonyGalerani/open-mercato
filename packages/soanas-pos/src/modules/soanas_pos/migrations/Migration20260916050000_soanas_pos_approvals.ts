import { Migration } from '@mikro-orm/migrations'

export class Migration20260916050000_soanas_pos_approvals extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "soanas_pos_approval_requests" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "terminal_id" uuid null,
        "transaction_id" uuid null,
        "line_id" uuid null,
        "kind" text not null,
        "status" text not null default 'pending',
        "requester_user_id" uuid not null,
        "approver_user_id" uuid null,
        "reason" text null,
        "decision_reason" text null,
        "payload_json" jsonb null,
        "before_json" jsonb null,
        "after_json" jsonb null,
        "idempotency_key" text null,
        "decided_at" timestamptz null,
        "consumed_at" timestamptz null,
        "expires_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "soanas_pos_approval_requests_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "soanas_pos_approvals_scope_idx"
        on "soanas_pos_approval_requests" ("organization_id", "tenant_id");
    `)
    this.addSql(`
      create index if not exists "soanas_pos_approvals_tx_status_idx"
        on "soanas_pos_approval_requests" ("transaction_id", "status");
    `)
    this.addSql(`
      create unique index if not exists "soanas_pos_approvals_idempotency_unique"
        on "soanas_pos_approval_requests" ("tenant_id", "idempotency_key")
        where "idempotency_key" is not null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "soanas_pos_approval_requests" cascade;`)
  }
}
