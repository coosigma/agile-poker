# Integration tests (`tests/int/`)

This directory holds **cross-subsystem integration-tier** tests: they wire two or
more subsystems together and exercise the seam between them (the pure reducer in
`app-core` behind the `RoomObject` adapter, a `CapabilityProvider` against a real
SQLite store, a frontend journey against an MSW-mocked network boundary — any
interaction that spans a package/app boundary). They run with `pnpm test:int`
via the root `vitest.int.config.ts`, and `test:int` is part of `pnpm verify`.

This tier is **project-specific by design**: the runner, the script, and this
convention exist, but there is no example test, because there is
no universal integration test (unlike unit tests, which are co-located, and
smoke tests, which are derived from the node/edge contract). You author one file
per subsystem interaction as the system grows.

## Relationship to co-located `*.int.test.ts`

Single-subsystem integration tests that stay **inside one package/app** (for
example `packages/app-core/src/poker/room-store.int.test.ts` or
`apps/cloudflare/test/room-object.int.test.ts`) remain co-located and run with
that package's own runner via `pnpm -r test`. `tests/int/` is reserved for tests
whose subject spans more than one subsystem and therefore has no single home
package.

## Layout

Group by subsystem:

```
tests/int/
  <subsystem>/
    <interaction>.test.ts
```

The frontend `apps/frontend/src/mocks/` layer now exists, but it backs a
**dev-only playground** (`apps/frontend/src/playground/`) rather than an
automated journey machine — a poker-domain WebSocket preview over the real pure
reducer. There is no `apps/frontend/src/journeys/` flow model. Drive frontend
integration tests through the existing helpers under `apps/frontend/src/test/`
(for example `apps/frontend/src/hooks/useRoomSocket.int.test.ts`).

## When this tier applies

- `--test-level unit` — this directory is not generated.
- `--test-level integration` (default) — generated; runs in `verify`.
- `--test-level e2e` — generated; runs in `verify`, plus smoke and story.
