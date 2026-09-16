import { Migration } from '@mikro-orm/migrations'

export class Migration20260916140000_soanas_pos_manual_tenders extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "soanas_pos_payment_tenders"
        add column if not exists "brand" text null,
        add column if not exists "installments" int null,
        add column if not exists "nsu" text null,
        add column if not exists "authorization_code" text null,
        add column if not exists "acquirer" text null,
        add column if not exists "external_terminal" text null,
        add column if not exists "external_reference" text null,
        add column if not exists "notes" text null,
        add column if not exists "confirmed_by_user_id" uuid null,
        add column if not exists "confirmed_at" timestamptz null,
        add column if not exists "reversed_at" timestamptz null,
        add column if not exists "reversal_reason" text null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "soanas_pos_payment_tenders"
        drop column if exists "brand",
        drop column if exists "installments",
        drop column if exists "nsu",
        drop column if exists "authorization_code",
        drop column if exists "acquirer",
        drop column if exists "external_terminal",
        drop column if exists "external_reference",
        drop column if exists "notes",
        drop column if exists "confirmed_by_user_id",
        drop column if exists "confirmed_at",
        drop column if exists "reversed_at",
        drop column if exists "reversal_reason";
    `)
  }
}
