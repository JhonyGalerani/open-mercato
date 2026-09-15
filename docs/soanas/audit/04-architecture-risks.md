# 04 — Architecture Risks

| ID | Risco | Prob. | Impacto | Mitigação |
|----|-------|-------|---------|-----------|
| RISK-ARCH-001 | Poluir `packages/core` com código BR/POS e tornar upstream merges impossíveis | M | Extreme | Packages `soanas-*` only; ADR-000; UPSTREAM_MODIFICATION log |
| RISK-ARCH-002 | Duplicar SalesOrder dentro de PosTransaction | M | High | PosTransaction orquestra por IDs (ADR-002) |
| RISK-ARCH-003 | Usar checkout web como PDV | L | High | Proibido no blueprint; UI `soanas_pos` própria |
| RISK-ARCH-004 | Contaminar licença com GPL/AGPL ou código Enterprise | M | Extreme | License audit; never import `@open-mercato/enterprise` |
| RISK-ARCH-005 | Assumir WMS phases 2–5 prontas | H | High | Gap analysis; feature flags; TECH-DEBT |
| RISK-ARCH-006 | Float em dinheiro | M | Extreme | Decimal/numeric + testes |
| RISK-ARCH-007 | Last-write-wins em sync offline de dinheiro/fiscal/estoque | M | Extreme | Políticas por domínio (ADR-004) |
| RISK-ARCH-008 | NFC-e schemas 2026 (IBS/CBS) mudarem | H | High | TaxEngine versionado + adapters |
| RISK-ARCH-009 | Vazamento cross-tenant | M | Extreme | Testes isolamento; scoped queries |
| RISK-ARCH-010 | Dupla cobrança Pix/TEF | M | Extreme | Idempotency + PAYMENT_UNKNOWN |
| RISK-ARCH-011 | SPEC-022 Mercato conflitar com Soanas | M | Medium | ADR documentando supersede |
| RISK-ARCH-012 | Relatórios pesados degradarem PDV | M | High | OLTP vs analytics separation |
| RISK-ARCH-013 | Agent hardware sem fila persistente | M | High | PrintJob spooler |
| RISK-ARCH-014 | Exclusão física de movimentos financeiros | L | Extreme | Reversões only |
| RISK-ARCH-015 | Escopo Blueprint reduzir-se a MVP e parar | H | Extreme | Coverage matrix gate; 0 NOT_STARTED only when done |

Ver também `docs/soanas/RISK-REGISTER.md`.
