# agile-poker

A lightweight **Planning Poker** app for agile estimation: create a room, share
an invite link or room code, have each participant vote privately, then reveal
and average the estimates in real time.

- **Backend:** Cloudflare Worker with a Durable Object per room (real-time
  WebSocket state), and a self-hosted Node fallback (SQLite + local object
  storage) for local/offline use.
- **Frontend:** Vite + React. Connects to the worker through
  `VITE_WORKER_ORIGIN` in production; in local dev Vite proxies `/graphql`,
  `/api`, and `/ws` to the backend.
- **Domain core:** framework-agnostic business logic behind a capability
  provider (`sql`, `kv`, `objects`, optional `actors`) so it never depends on
  platform bindings directly.

## Getting started

```sh
pnpm install
pnpm dev:cf        # Cloudflare Worker (primary)
# or
pnpm dev:local     # self-hosted Node worker (SQLite + local object storage)
```

Run the frontend in a separate terminal:

```sh
pnpm dev:frontend
```

## API

The primary contract is the Planning Poker REST + WebSocket surface, served by
the worker:

- `GET /api/health` — operational health endpoint
- `PUT`/`GET /api/rooms/:roomId` — room create / lookup
- `GET /ws?room=ROOM_ID` — room WebSocket (Durable Object)

A GraphQL endpoint is also exposed at `/graphql` (an executable `graphql-js`
schema with introspection), but the full GraphQL migration is deferred; new
contributors should target the REST + WebSocket endpoints above.

The backend keeps a dormant, generic **actor seam** — the `actorSnapshot` /
`sendActorEvent` GraphQL operations plus the `actors` capability port — but no
actor implementation ships by default; wiring one in later is purely additive.
See [`packages/app-core/src/actors/README.md`](packages/app-core/src/actors/README.md).

## Testing

The testing model (families, layers, and where each runs) is documented in
[`TESTING.md`](TESTING.md), with the e2e registry in
[`tests/CONTRACT.md`](tests/CONTRACT.md) and the story pipeline in
[`docs/sdd.md`](docs/sdd.md).

```sh
pnpm verify        # typecheck + lint + format + unit + integration + build
pnpm test:smoke    # node/edge smoke e2e
pnpm test:story    # story e2e (local; two real browser clients)
```
