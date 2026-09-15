# Soanas Documentation

Produto operacional brasileiro de varejo/restaurante construído **sobre** Open Mercato (não “uma tela de PDV no admin”).

## Start here

1. [audit/00-repository-overview.md](./audit/00-repository-overview.md)
2. [O-QUE-FOI-FEITO.md](./O-QUE-FOI-FEITO.md) — **entrega atual (o que foi feito)**
3. [BLUEPRINT-COVERAGE.md](./BLUEPRINT-COVERAGE.md)
4. [ROADMAP.md](./ROADMAP.md)
5. [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md)
6. [adr/](./adr/)

## Indexes

| Doc | Purpose |
|-----|---------|
| `O-QUE-FOI-FEITO.md` | **Relatório do que já foi entregue** |
| `audit/` | Repositório, reuse map, gaps, riscos, deps, baseline |
| `BLUEPRINT-COVERAGE.md` | Matriz rastreável (IDs) |
| `blueprint-coverage.json` | Fonte machine-readable |
| `RISK-REGISTER.md` | Riscos vivos |
| `STATUS-FEITO-VS-FALTA.md` | O que foi feito × o que falta (visão executiva) |
| `TECH-DEBT.md` | Dívidas explícitas |
| `runbooks/` | Operação em incidente |
| `../licenses/` | Licenças e notices |

## Specs

`.ai/specs/2026-09-15-soanas-*.md`

## Regenerar coverage

```bash
node scripts/soanas-generate-blueprint-coverage.mjs
```
