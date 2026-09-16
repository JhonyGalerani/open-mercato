import { Migration } from '@mikro-orm/migrations'

export class Migration20260916120000_soanas_payments_pix_idempotency extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create unique index if not exists "soanas_payments_br_pix_charges_idempotency_unique"
        on "soanas_payments_br_pix_charges" ("tenant_id", "provider", "idempotency_key")
        where "deleted_at" is null and "idempotency_key" is not null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "soanas_payments_br_pix_charges_idempotency_unique";`)
  }
}
