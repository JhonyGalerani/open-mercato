# Dependency Licenses — Soanas

**Updated:** 2026-09-15

## Policy

- Prefer MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0.
- Avoid GPL/AGPL/SSPL and other strong copyleft in Soanas proprietary surface.
- Do **not** copy or relicense `@open-mercato/enterprise` sources.
- Open Mercato OSS packages used as dependencies remain MIT (`LICENSE` at repo root).

## Open Mercato foundation

| Component | License | Notes |
|-----------|---------|-------|
| open-mercato monorepo (OSS packages) | MIT | Root `LICENSE` |
| `@open-mercato/enterprise` | Commercial | **Do not import into Soanas packages** |

## Soanas packages (planned)

Soanas product packages will carry a commercial Soanas license when distributed as product; while developed in this workspace they must not contaminate MIT core. Keep Soanas code in `packages/soanas-*` with explicit package LICENSE files at creation time.

## Adding a dependency

1. Check license on npm / GitHub.
2. Add row below.
3. Update `THIRD_PARTY_NOTICES.md` if required by license.
4. Reject if copyleft risk to proprietary Soanas.

## Third-party production dependencies (Soanas-specific)

| Package | Version | License | Used by | Status |
|---------|---------|---------|---------|--------|
| _none yet_ | — | — | — | — |

## Review log

| Date | Reviewer | Note |
|------|----------|------|
| 2026-09-15 | Agent audit | Initial policy; no Soanas npm deps yet |
