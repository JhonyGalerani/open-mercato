import { Migration } from '@mikro-orm/migrations'

export class Migration20260916060000_soanas_pos_reversal extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "soanas_pos_transactions"
        add column if not exists "reversed_at" timestamptz null,
        add column if not exists "reversal_reason" text null,
        add column if not exists "reversal_cash_movement_id" uuid null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "soanas_pos_transactions"
        drop column if exists "reversed_at",
        drop column if exists "reversal_reason",
        drop column if exists "reversal_cash_movement_id";
    `)
  }
}
