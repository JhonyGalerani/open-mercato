# Soanas — Technical Roadmap (E0–E9)

**SSOT de ordem:** este arquivo.  
**Coverage:** `blueprint-coverage.json` (303 IDs) — contadores via `yarn soanas:sync-status`.  
**Atribuição etapa↔ID:** `stage-assignment.json` + `yarn soanas:check-stages`.  
**Retomada:** `EXECUTION-CHECKPOINT.md`.  
**Liberação:** `RELEASE-CHECKLIST.md`.

> **Histórico:** o roadmap antigo usava Phase 0–8 e Gates 0/1. A tabela de mapeamento abaixo é canônica; não reutilize números antigos com outro significado.

## Mapeamento Gates / Phases → E0–E9

| Legado | Significado legado | Etapa canônica | Notas |
|--------|--------------------|----------------|-------|
| Phase 0 / Foundation | Pacotes base, ADRs, coverage | **E0** (docs/estrutura) + entregas já no código | Código foundation permanece; E0 fecha contradições documentais |
| Gate 0 | Segurança, recovery, PrintJob, isolamentoência | **E2** (hardening já parcial) + evidência em `audit/08` | Closeout 2026-09-17 — Cloud Postgres efêmero |
| Gate 1 | Pagamentos manuais divididos | **E2** | `TC-SOANAS-POS-MANUAL-TENDERS-001` |
| Phase 1 Retail POS+Cash | Caixa + PDV + saga | **E2** | Retail Sale v1 VALIDATED ≠ Blueprint completo |
| Phase 2 Fiscal+Pix | NFC-e + Pix integrado | **E5** (+ Pix opcional fora do caminho crítico) | Manual tenders não dependem de Pix→POS |
| Phase 3 Offline+Hardware | Outbox, sync, Device Agent | **E3** + **E4** | Separados de propósito |
| Phase 4 Restaurant+KDS | Mesas, comandas, KDS | **E6** | |
| Phase 5 Procurement+Finance | Compras, AP/AR | **E7** | |
| Phase 6 National scale | Multi-UF, NFS-e | **E7** (escala) | Pode ficar fora do lançamento inicial |
| Phase 7 Reporting/Loyalty/SaaS | Dashboards, planos | **E7** | |
| Phase 8 Hardening | Perf, LGPD, DR, E2E final | **E8** (instalador) + **E9** (aceite) | |

## Priority invariant

```
data integrity > money integrity > fiscal integrity > inventory integrity
> security > reliability > UX > visual polish > AI
```

## E0 — Fonte única de verdade e baseline

**Objetivo:** plano sem contradições; 303 IDs atribuídos a etapas; baseline reproduzível; próximo passo executável.

| Entrega | Critério |
|---------|----------|
| Docs SSOT | README, ROADMAP E0–E9, IMPLEMENTATION-STATUS, STATUS derivado, TECH-DEBT, checkpoint, release checklist |
| Coverage | Contadores só via sync; nenhum ID VALIDATED sem DoD |
| Inventário pacotes | Propósito, entidades, migrations, APIs, UI, gaps |
| Stage map | Todo ID → E0…E9 |

**Exit:** checkpoint aponta SHA/branch/PR; `yarn soanas:check-coverage` + `yarn soanas:check-stages` verdes.

## E1 — Arquitetura local e esqueleto instalável funcional

**Depende de:** E0.  
**ADRs:** ADR-005 (local-first), ADR-013 (topologia loja — ver `adr/`).

| Entrega | Critério |
|---------|----------|
| Topologia | Servidor local da loja (Postgres) + terminais LAN **ou** decisão explícita alternativa |
| Runtime local | Init, auth suportada, catálogo, venda manual durável, reinício sem perda |
| Desktop | Shell visual que aponta para serviços **locais** (não só URL cloud) |
| Provisionamento | Política offline de acesso; sem senha em texto puro; sem CDN involuntária para assets essenciais |

**Exit:** fluxo local real comprovado no Cloud (Linux) + escolha desktop documentada; instalador Windows = E8.

**Estados de execução:** `CLOUD_VERIFIED` para boot/smoke local; `LOCAL_VALIDATION_PENDING` para Windows/.exe.

## E2 — Caixa e PDV operacionais completos

**Depende de:** E1 para operação offline-ready; online Cloud pode avançar em paralelo com Gates 0/1 já fechados.

Abertura/fechamento, sangria/suprimento, ledger append-only, tenders manuais (sem TEF), hold/resume/transfer com estoque, cancel/return, relatórios/comprovantes previstos.

**Exit:** operador completa jornada pelo visual sem SQL/API manual.

## E3 — Offline, durabilidade e sincronização

**Depende de:** E1 topologia. Outbox persistente, idempotência transacional, conflitos por domínio (não LWW em dinheiro/estoque), observabilidade de sync.

**Exit:** venda+reabertura offline sobrevivem a reinício; reconexão sem duplicação.

## E4 — Hardware local

Device Agent, ESC/POS, gaveta, scanner, balança; PrintJob durável (ADR-011); simuladores ≠ homologação física.

## E5 — Fiscal brasileiro

Módulo `soanas-fiscal-br` isolado; NFC-e SP; contingência; sem inventar autorização offline; homologação = `BLOCKED_EXTERNAL` sem credenciais.

## E6 — Restaurante e KDS

Áreas, mesas, comandas, modificadores, Waiter PWA, KDS; LAN sem internet.

## E7 — Demais requisitos do Blueprint

Compras, financeiro, fidelidade, delivery, relatórios, integrações, SaaS. Separar lançamento instalável inicial vs escopo completo **somente com concordância do usuário**.

## E8 — Instalador Windows e ciclo de vida

`.exe`/`.msi`, runtime, serviços locais, update, backup/restore, desinstalação com preservação de dados. Cross-build ≠ validação Windows.

## E9 — Aceite integrado e entrega

Jornada limpa: setup → caixa → venda dividida → desconexão → venda → reinício → sync → impressão → fechamento → relatório → backup.  
`RELEASE_READY` só com evidências aplicáveis (incl. Windows/hardware/fiscal quando no escopo).

## Pacotes existentes (baseline 2026-09-18)

| Pacote | Papel | Etapa primária de lacunas |
|--------|-------|---------------------------|
| `soanas-core` | ACL, erros, helpers | E0/E7 |
| `soanas-establishments` | Loja fiscal/estabelecimento | E1/E5 |
| `soanas-cash` | Caixa/ledger | E2 |
| `soanas-pos` | PDV/saga/PrintJob | E2 |
| `soanas-payments-br` | Pix (preservar; não crítico manual) | E2/E7 |
| `soanas-desktop` | Shell local + journal E1 (sem .exe) | E1/E8 |
| *ausentes* | `soanas-offline`, `soanas-hardware`, `soanas-fiscal-br`, restaurant… | E3–E7 |

## Contadores (derivados — não congelar)

<!-- soanas:derived-counts:start -->
```
Blueprint coverage (IDs): ANALYZED 229 | IMPLEMENTED 40 | TESTED 27 | VALIDATED 7 / 303
Validated (DoD completa): 2.3%
```
<!-- soanas:derived-counts:end -->

`VALIDATED 7/303` **não** é “% de código pronto”. Métrica de produto: vertical slices em `IMPLEMENTATION-STATUS.md`.
