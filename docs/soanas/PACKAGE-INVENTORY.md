# Soanas — Package Inventory

**Data:** 2026-09-18  
**SHA base inventário:** `670c535e3` (PR #5 head) + commits E0/E1 desta branch.  
**Auditoria antiga `audit/02`:** histórica (greenfield); **não** descreve o estado atual.

## Pacotes presentes

### `@open-mercato/soanas-core`

| Aspecto | Conteúdo |
|---------|----------|
| Propósito | ACL catalog, erros, helpers de eventos/validators compartilhados |
| Entidades / migrations | Nenhuma ORM própria |
| APIs / UI | Nenhuma rota própria |
| Testes | 1 unit |
| Dependências | shared |
| Lacunas | Telemetria/quotas SaaS (E7); profiles offline auth (E1) |

### `@open-mercato/soanas-establishments`

| Aspecto | Conteúdo |
|---------|----------|
| Propósito | Estabelecimento / vínculo fiscal loja |
| Entidades | `data/entities.ts` (FiscalEstablishment e correlatos) |
| Migrations | 1 |
| APIs / UI / ACL | módulo `soanas_establishments` |
| Testes | 1 |
| Lacunas | Provisionamento terminal local (E1); campos NFC-e profundos (E5) |

### `@open-mercato/soanas-cash`

| Aspecto | Conteúdo |
|---------|----------|
| Propósito | Registro, sessão, sangria/suprimento, fechamento, ledger |
| Entidades | Register/Session/Movement/… |
| Migrations | 2 |
| APIs | `/api/soanas_cash/...` |
| UI | `/backend/soanas/cash/*` |
| Testes | 8 arquivos (+ Gate 0 E2E) |
| Lacunas | Transferência avançada, PDF térmico completo (E2 restante) |

### `@open-mercato/soanas-pos`

| Aspecto | Conteúdo |
|---------|----------|
| Propósito | Terminais, PosTransaction, tenders manuais, completeSale saga, PrintJob, hold/resume |
| Entidades | POS + PrintJob + approvals |
| Migrations | 6 |
| APIs | `/api/soanas_pos/...` |
| UI | `/backend/soanas/pos/*` (sell, history, terminals) |
| Testes | 23 arquivos + integração Playwright |
| Lacunas | Transfer com reserva estoque; STORE_CREDIT ledger; ESC/POS real; offline outbox |

### `@open-mercato/soanas-payments-br`

| Aspecto | Conteúdo |
|---------|----------|
| Propósito | Pix BR (mock/provider); **preservar**; não bloquear tenders manuais |
| Entidades | Pix charge/audit |
| Migrations | 2 |
| Testes | 5 + Gate0 PIX-SCOPE |
| Lacunas | Wiring opcional na saga POS (fora do caminho crítico) |

## Pacotes Blueprint ainda ausentes

| Módulo coverage | Etapa | Estado |
|-----------------|-------|--------|
| `soanas_offline` | E3 | Não criado (ADR-005/013 definem direção) |
| `soanas_hardware` | E4 | Não criado |
| `soanas_fiscal_br` | E5 | Não criado |
| `soanas_restaurant` / `soanas_kds` | E6 | Não criados |
| procurement/finance/loyalty/delivery/reporting/saas/integrations | E7 | Não criados |
| Desktop installer `.exe`/`.msi` | E8 | **instalador ainda não produzido/validado** |
| `soanas-desktop` foundations | E1 | Criado (journal + shell contract; sem Electron empacotado) |

## Convenções preservadas

- Pacotes `soanas-*` fora de `packages/core` (ADR-001)
- Sem ORM relationships cross-module; FKs por ID
- Tenant + organization (+ establishment) scoping
- Optimistic locking onde entidades user-editable

## Não fazer

- Movimentação cosmética em massa entre pacotes
- Substituir implementações funcionais por scaffolds
- Classificar pacotes existentes como “inexistentes” em STATUS
