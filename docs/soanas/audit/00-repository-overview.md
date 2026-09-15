# 00 — Repository Overview

**Audit date:** 2026-09-15  
**Open Mercato version:** `0.7.0`  
**Commit:** `30d509eeb481ae4778be771d6c3992042add2d1a` (`main`)  
**Branch de trabalho:** `cursor/soanas-blueprint-foundation-5019`  
**License root:** MIT (`LICENSE`)  
**Enterprise package:** commercial license (`packages/enterprise/LICENSE.md`) — **não copiar para Soanas**

## Purpose of this audit

Mapear o estado do monorepo Open Mercato antes de qualquer implementação Soanas, conforme o Blueprint Funcional Completo (SSOT).

## Monorepo shape

| Path | Role |
|------|------|
| `apps/mercato` | App Next.js de referência (`@open-mercato/app`) |
| `apps/docs` | Documentação Docusaurus |
| `packages/*` | Platform packages (`@open-mercato/*`) |
| `docs/` | Notas internas (design-system, WMS, manuals) — **não** o site docs |
| `.ai/specs/` | Specs OSS |
| `.ai/specs/enterprise/` | Specs comerciais EE |
| `external/official-modules/` | Submodule opcional — **ausente neste checkout** |

## Yarn workspaces

```
apps/*
packages/*
external/official-modules/packages/*
```

Package manager: Yarn 4.17.1 · Node 24.x

## Soanas presence

| Check | Result |
|-------|--------|
| Código `soanas*` | **Nenhum** |
| Docs `docs/soanas/` | **Criados nesta auditoria** |
| Packages `soanas-*` | **Não existem** |
| Specs `*soanas*` | **Não existiam** (Fase 0 specs criadas após audit) |

## Existing POS / BR fiscal adjacent work

| Item | Status |
|------|--------|
| `SPEC-022` POS module | Proposed only — issue #391 — **sem código** |
| `SPEC-022a` POS tile browsing | Proposed — **sem código** |
| `SPEC-024` Financial module | Spec — **sem módulo financial** |
| NFC-e / NF-e BR / NFS-e / SEFAZ | **Ausente** |
| PIX / TEF / sangria / KDS / restaurant | **Ausente** |
| Sales channel type "POS" | Conceito de canal — **não é PDV** |
| `packages/checkout` | Pay-links / simple checkout — **não é caixa** |

## Strategy implication

Soanas deve nascer como **camada de produto** (packages `soanas-*` + eventual app standalone via `create-mercato-app`), reutilizando o core Mercato, **sem** transformar checkout web em PDV e **sem** copiar `@open-mercato/enterprise`.

## Baseline health (pré-mudança)

Ver `docs/soanas/audit/06-baseline-tests.md` (preenchido após execução dos testes).
