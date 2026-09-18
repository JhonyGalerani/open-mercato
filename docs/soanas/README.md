# Soanas Documentation

Produto operacional brasileiro de varejo/restaurante construído **sobre** Open Mercato (não “uma tela de PDV no admin”).

## Start here

1. [EXECUTION-CHECKPOINT.md](./EXECUTION-CHECKPOINT.md) — **retomada exata** (branch/SHA/próximo passo)
2. [ROADMAP.md](./ROADMAP.md) — ordem canônica **E0–E9**
3. [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md) — estado por área + evidências
4. [BLUEPRINT-COVERAGE.md](./BLUEPRINT-COVERAGE.md) / [blueprint-coverage.json](./blueprint-coverage.json) — 303 IDs
5. [PACKAGE-INVENTORY.md](./PACKAGE-INVENTORY.md) — pacotes reais vs ausentes
6. [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) — critérios de instalação/liberação
7. [adr/](./adr/) — decisões (incl. ADR-005, ADR-013 topologia local)

## Indexes

| Doc | Purpose |
|-----|---------|
| `EXECUTION-CHECKPOINT.md` | Retomada pelo próximo agente |
| `ROADMAP.md` | E0–E9 + mapeamento Gates/Phases legados |
| `IMPLEMENTATION-STATUS.md` | Status atual + vertical slices |
| `STATUS-FEITO-VS-FALTA.md` | Resumo derivado para produto (contadores sync) |
| `O-QUE-FOI-FEITO.md` | Relatório de entrega (histórico + sync counts) |
| `PACKAGE-INVENTORY.md` | Inventário técnico dos pacotes |
| `RELEASE-CHECKLIST.md` | Evidências para release |
| `TECH-DEBT.md` | Dívidas reais |
| `RISK-REGISTER.md` | Riscos vivos |
| `stage-assignment.json` | Todo ID → etapa E0–E9 |
| `audit/` | Relatórios **históricos datados** — não substituem status atual |
| `BLUEPRINT-COVERAGE.md` | Visão derivada do coverage |
| `blueprint-coverage.json` | Fonte estruturada dos 303 requisitos |
| `runbooks/` | Operação em incidente |
| `../licenses/` | Licenças e notices |

## Specs

`.ai/specs/2026-09-15-soanas-*.md`

## Comandos

```bash
yarn soanas:sync-status          # deriva contadores → docs
yarn soanas:check-coverage       # falha se drift / over-claim
yarn soanas:check-stages         # todo ID atribuído a E0–E9
yarn soanas:validate-local       # matriz rápida local
yarn soanas:validate-local --full  # + migrations (Docker)
yarn soanas:validate-migrations
```

Nunca edite manualmente os blocos `<!-- soanas:derived-counts:* -->` / `<!-- soanas:coverage-summary:* -->`.

**instalador ainda não produzido/validado.** Cloud green ≠ offline-first.
