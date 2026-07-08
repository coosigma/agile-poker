# e2e registry

The **authoritative, maintainer-approved list of every e2e test**. See
[`TESTING.md`](../TESTING.md) for the family/layer model this implements. e2e is
the tip of the pyramid: **scenario-first, realism-driven, not coverage**
(Principle B). Anything provable in-process belongs at unit or integration.

Per `TESTING.md` §4, **no e2e test may exist without a row here**, added with
maintainer confirmation before/with its implementation.

## Two families of e2e

Model the deployed system as a **graph** (nodes = deployable subsystems, edges =
real interfaces). e2e splits into **functional smoke** (topology-driven) and
**story** (scenario-driven):

| Family · kind               | Anchored to                   | "Exactly one"                                                          | Home                    | Runs in                      |
| --------------------------- | ----------------------------- | ---------------------------------------------------------------------- | ----------------------- | ---------------------------- |
| functional · **node smoke** | each deployable node          | one per node                                                           | `apps/<node>/test/e2e/` | **Remote CI** _and_ pre-push |
| functional · **edge smoke** | each **node pair** (one edge) | one per node pair; multiple interactions become **facets in one file** | `tests/edge/`           | **Remote CI** _and_ pre-push |
| story                       | a user scenario               | as many as useful                                                      | `tests/sdd/`            | **Local pre-push only**      |

A **shared library is not a node** and gets no e2e. A node smoke asserts
node-intrinsic realism only and must not duplicate an edge assertion. A node is
either **owned** (you deploy it → **node smoke**) or an **external dependency
system** you only connect to (DB, object store, identity provider, third-party
API) → **no node smoke**, but the **edge** `owned-node --> external-system` gets
an **edge smoke** proving real connectivity.

Files follow `TESTING.md` §6: `<kebab-subject>.<token>.spec.ts`, token one of
`smoke` / `story`. An edge's subject is the **node pair only** — no protocol,
no function (those are **facets inside the one edge file**).

## The registry

Status: ✅ implemented · 🔨 planned · ⏸ deferred · ♻️ to relocate/rename

### functional · node smoke — one per deployable node

| Node        | Contract                                                                                                                        | Spec                                             | Why it must be e2e                                                                                                              | Status                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| frontend    | The app loads in a real browser and renders its shell far enough to start creating/entering a room.                             | `apps/frontend/test/e2e/frontend.smoke.spec.ts`  | Only a real browser + built frontend prove the node itself boots and renders — independent of any backend.                      | ✅ implemented                        |
| backend     | The real Worker completes a WebSocket handshake and rejects a malformed frame with an `error` (talking directly to the worker). | `apps/cloudflare/test/e2e/backend.smoke.spec.ts` | Proves the deployed boundary decodes frames and replies over a live socket; in-process doubles cannot vouch for real transport. | ✅ implemented                        |
| self-hosted | The self-hosted server boots and serves its base route.                                                                         | —                                                | Proves the alternative deployment runs for real.                                                                                | ⏸ pending "supported target" decision |

### functional · edge smoke — one per node pair (facets inside the file)

| Edge (node pair)   | Facets                                                                                                                                                              | Spec                                        | Why it must be e2e                                                                                                                                    | Status                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| frontend ↔ backend | **①** HTTP `/api` proxy reaches backend health. **②** WS `/ws` opens and delivers room state. (Independent failure modes → two `test()` facets in one file per §6.) | `tests/edge/frontend-backend.smoke.spec.ts` | Proves the real frontend↔backend wiring — neither side in isolation. The two facets share no code path, so each must be able to go red independently. | ✅ implemented (both facets) |

### story (local pre-push only)

| Scenario                                                                                                                                                                                                                                     | Source + spec                                                                                                                                                                                                                                                                                                                                                                  | Why it must be e2e                                                                                                                                                                                                                                                             | Status                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **Two people estimate a ticket together.** Two real browser clients join one room via an invite link, each casts a different estimate, the host reveals a consistent average, then starts a new round — driven entirely through the real UI. | `tests/sdd/two-people-estimate/two-people-estimate.md` → UCs (`tests/sdd/uc/`) + machine → `tests/sdd/generated/two-people-estimate.story.spec.ts` (positive) and `…/two-people-estimate.negative.story.spec.ts` (auto-generated negatives)                                                                                                                                    | The flagship realistic scenario: a real multi-user session over the real transport. Its _coverage_ counterpart (multi-socket broadcast consistency) already lives at integration in `apps/cloudflare/test/room-object.int.test.ts`; this exists for **realism**, not coverage. | ✅ implemented (retired `room-flow.spec.ts`) |
| **Two people estimate a ticket together (via room code).** Same journey, but the teammate joins by **typing the room code** shared by the host instead of opening a link.                                                                    | `tests/sdd/two-people-estimate-by-code/two-people-estimate-by-code.md` → UCs (`tests/sdd/uc/`, **reusing** the shared create/round/vote/reveal UCs + door-specific `share-room-code`/`join-by-code`) + machine → `tests/sdd/generated/two-people-estimate-by-code.story.spec.ts` (positive) and `…/two-people-estimate-by-code.negative.story.spec.ts` (empty-code rejection). | The second door (code entry) exercises the join path that the invite-link story does not. Realism, not coverage; shares building blocks with the link story.                                                                                                                   | ✅ implemented                               |

## Rules for changing this layer

1. **Coverage never justifies an e2e test.** If a case is about a branch, edge,
   or error path, it belongs at unit or integration. e2e rows must be
   justifiable as a _user scenario in a realistic environment_.
2. **One node smoke per node, one edge smoke per node pair.** Several
   interactions over the same edge are **facets in the one file**, not extra
   edges. A second edge-smoke _file_ for the same pair is a smell.
3. **Every row needs a "why it must be e2e".** If you cannot write it, it is not
   an e2e test.
4. **Family decides CI routing.** New smoke → remote CI + pre-push. New story →
   pre-push only. Keep the Playwright projects/tags aligned with this table.
5. **A story's markdown is the source of truth.** The `.story.spec.ts` is
   generated from its `.md` and re-generated when the `.md` changes.

## Running

```sh
pnpm test:smoke          # node + edge smokes only — this is what remote CI runs
pnpm test:story          # BDD stories only (once any exist) — pre-push, local
pnpm test:e2e            # both projects — the pre-push hook runs this
APP_URL=https://… pnpm test:e2e   # target an already-running/deployed worker
```

Routing: remote CI (`.github/workflows/ci.yml`) runs `pnpm test:smoke`; the
pre-push hook (`.husky/pre-push`) runs `pnpm test:e2e` (smoke + story). Local
runs boot wrangler + frontend automatically unless `APP_URL` is set.
