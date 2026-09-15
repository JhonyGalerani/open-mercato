# Soanas Documentation

Produto operacional brasileiro de varejo/restaurante construído **sobre** Open Mercato (não “uma tela de PDV no admin”).

## Start here

1. [audit/00-repository-overview.md](./audit/00-repository-overview.md)
2. [BLUEPRINT-COVERAGE.md](./BLUEPRINT-COVERAGE.md)
3. [ROADMAP.md](./ROADMAP.md)
4. [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md)
5. [adr/](./adr/)

## Indexes

| Doc | Purpose |
|-----|---------|
| `audit/` | Repositório, reuse map, gaps, riscos, deps, baseline |
| `BLUEPRINT-COVERAGE.md` | Matriz rastreável (IDs) |
| `blueprint-coverage.json` | Fonte machine-readable |
| `RISK-REGISTER.md` | Riscos vivos |
| `TECH-DEBT.md` | Dívidas explícitas |
| `runbooks/` | Operação em incidente |
| `../licenses/` | Licenças e notices |

## Specs

`.ai/specs/2026-09-15-soanas-*.md`

## Regenerar coverage

```bash
node scripts/soanas-generate-blueprint-coverage.mjs
```
