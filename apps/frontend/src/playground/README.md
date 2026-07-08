# Room playground (`apps/frontend/src/playground/`)

A **dev-only** visual preview of `RoomScreen` across seeded room states. It is
not a test tier: nothing in `pnpm verify` or CI exercises or asserts against it.
(Its `playground.html` entry is still compiled by `vite build` — and therefore
by `pnpm build`/`pnpm verify` — but only as static output, never run as a test.)
It is a tool for eyeballing the UI while developing.

Run it with the frontend dev server and open the playground entry:

```
pnpm --filter @agile-poker/frontend dev:playground
# or: pnpm --filter @agile-poker/frontend dev, then open /playground.html
```

## How it works

The playground never talks to a worker. Instead it overrides the global
`WebSocket` (only inside the isolated `/playground.html` bundle) with a mock in
`../mocks/`:

- `../mocks/room-server.ts` — `MockRoomServer` holds room state and applies
  messages through the **real** pure reducer from
  `@agile-poker/app-core/poker` (`applyClientMessage` / `toRoomStateView` /
  `leaveRoom`). It re-implements none of the domain; it only plays the Durable
  Object's transport role (allocate ids, broadcast the projected view).
- `../mocks/mock-room-socket.ts` — a mock `WebSocket` bound to a
  `MockRoomServer`. `installMockRoomSocket(server)` swaps `globalThis.WebSocket`
  so the real `useRoomSocket` hook and `RoomScreen` run unmodified.

`scenarios.ts` seeds staged participants/votes/phase, then the previewed "You"
client connects live — so each preview is fully interactive (vote, start round,
reveal) and always matches production reducer behaviour.

## Boundaries

- Effect is never imported here; the mocks depend only on the browser-safe
  `@agile-poker/app-core/poker` barrel.
- The `WebSocket` override is confined to the `playground.html` entry and never
  runs on the application `index.html` path.
