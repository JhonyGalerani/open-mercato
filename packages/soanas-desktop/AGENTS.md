# Soanas Desktop

Electron shell + store-local runtime foundations for the Windows-installable PDV (ADR-013).

## Always

- Point the shell at **local** services (`127.0.0.1` / store LAN), never a cloud-only URL as the operator path.
- Keep sale durability in local durable storage (journal/outbox → E3 Postgres outbox); memory-only is forbidden.
- Do not claim Windows installer validation from Linux Cloud builds alone.

## Validation

```bash
yarn workspace @open-mercato/soanas-desktop test
yarn workspace @open-mercato/soanas-desktop build
```
