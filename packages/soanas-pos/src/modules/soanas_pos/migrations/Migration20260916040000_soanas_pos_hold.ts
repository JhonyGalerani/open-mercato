import { Migration } from '@mikro-orm/migrations'

/**
 * POS-HOLD-001: suspend/resume fields on soanas_pos_transactions.
 * Status value HELD is stored as text (no enum constraint) — no DDL for the status set.
 */
export class Migration20260916040000_soanas_pos_hold extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "soanas_pos_transactions"
        add column if not exists "hold_name" text null,
        add column if not exists "held_at" timestamptz null,
        add column if not exists "held_by_user_id" uuid null,
        add column if not exists "expires_at" timestamptz null;
    `)
    this.addSql(`
      create index if not exists "soanas_pos_transactions_held_idx"
        on "soanas_pos_transactions" ("tenant_id", "organization_id", "status", "held_at")
        where "deleted_at" is null and "status" = 'HELD';
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "soanas_pos_transactions_held_idx";`)
    this.addSql(`
      alter table "soanas_pos_transactions"
        drop column if exists "hold_name",
        drop column if exists "held_at",
        drop column if exists "held_by_user_id",
        drop column if exists "expires_at";
    `)
  }
}
