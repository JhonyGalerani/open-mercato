# Soanas Core

Shared foundation for Soanas domain packages: Brazilian document validators, error model, ACL feature catalog, and role profile seeds.

## Always

- Keep this package free of Mercato core mutations.
- Prefer ID references and events over ORM cross-module relations.
- Cover money/fiscal/document validators with unit tests.

## Validation

```bash
yarn workspace @open-mercato/soanas-core test
yarn workspace @open-mercato/soanas-core build
```
