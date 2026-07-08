# Testing specification

A deterministic, **human-facing** way to place every test in exactly one layer,
decide **who authors and approves it**, and choose **where it runs**.

Sections 1–6 define the general taxonomy; Section 7 is this repository's
instantiation.

---

## 1. Two families, three layers

Every test belongs to one of **two families**, and within them to a **layer**:

- **functional** — verifies that _something at a given level works correctly_.
  Coverage lives here. Families: **unit**, **integration**, and the structural
  **smoke** e2e (node & edge). Stored **close to what they test** (§6).
- **BDD (story)** — a human-readable, realistic **user scenario**. Realism, not
  coverage. Stored **separately** (§6).

Organisation follows the **family/layer**, _not_ whether a test happens to be
"e2e". A node/edge smoke is e2e by runtime but **functional** by intent, so it
lives with its subsystem — not with the story scenarios.

A test's layer is defined by **whose variables are under test** — the ownership
topology — not by which machinery the code happens to touch.

| Family     | Layer           | What is under test (ownership topology)                                                                                             | Responsibility                                                                                             |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| functional | **unit**        | Logic owned **entirely within a single module** — a pure function.                                                                  | The module's logic is correct.                                                                             |
| functional | **integration** | Behaviour whose variables are owned by a **single subsystem**; collaborators outside that subsystem are represented by **doubles**. | Guarantee the subsystem's **functional completeness** — that its unit-level modules collaborate correctly. |
| functional | **smoke** (e2e) | The **realism of a node or edge** in the deployment graph, over the real interface.                                                 | Confirm the node boots / the edge connects, for real.                                                      |
| BDD        | **story** (e2e) | A realistic multi-step **user scenario** across the real product.                                                                   | Confirm the lived experience — realism, not coverage.                                                      |

A **subsystem** is an independently deployable/runnable unit (a service, a web
app) — a **node** in the deployment topology. A shared library is **not** a
subsystem and **not** a node: it has no user environment, so it has **no e2e at
all** (no node smoke, no edge smoke) — only unit and integration.

## 2. Two governing principles

**Principle A — Touching ≠ Crossing.**
Classify by whose variables are under test, not by what the code touches. Most
frontend behaviour involves the backend; that alone does **not** make it e2e. A
frontend test that drives a **doubled** backend is _integration_ — it validates
the frontend subsystem's own side of the contract.

**Principle B — e2e is scenario, not coverage.**
Coverage (branches, edge cases, error paths) is carried by **unit + integration**.
e2e carries **realism and user journeys**. e2e does not chase coverage; it
scripts a playground-like scenario that mirrors the user's real environment.
Overlap between an e2e scenario and integration coverage is acceptable and
expected — they are asserting different things (a lived journey vs. a branch).

## 3. e2e taxonomy: smoke (functional) vs story (BDD)

Model the deployed system as a **graph**: **nodes** are deployable subsystems,
**edges** are the real interfaces between two nodes. e2e splits into two families
— structural **smoke** (functional) and narrative **story** (BDD):

| Family     | Kind           | Anchored to                                      | "Exactly one" rule | Asserts                                                                         | Runs in                                   |
| ---------- | -------------- | ------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------- | ----------------------------------------- |
| functional | **node smoke** | each deployable **node**                         | one per node       | the node itself boots and performs its own basic function in a real environment | **Remote CI** + pre-push                  |
| functional | **edge smoke** | each **edge** (real interface between two nodes) | one per edge       | the two nodes actually coordinate over their real interface                     | **Remote CI** + pre-push                  |
| BDD        | **story**      | a **user scenario**                              | as many as useful  | a realistic, demo-like user journey through the real product                    | **Local pre-push only** (never remote CI) |

Rules that fall out of the graph model:

- **A shared library has no node smoke** — it is not a node.
- **Owned vs external nodes.** A node is either **owned** — you deploy it, so it
  gets a **node smoke** — or an **external dependency system** you only connect
  to (a database, object store, identity provider, third-party API): it gets
  **no node smoke**, but the **edge** `owned-node --> external-system` gets an
  **edge smoke** proving real connectivity. Same-process components are **one
  node**, never an internal edge.
- **One edge per node pair.** An edge is the _topological fact_ that two nodes
  coordinate; the several interactions over it (protocols, functions) are
  **facets inside the one edge-smoke file**, not separate edges. See §6 for the
  in-file facet convention.
- **Node smoke asserts node-intrinsic realism only** — it must not duplicate an
  edge assertion. (frontend node smoke = the app loads and renders its shell;
  the frontend↔backend edge smoke is a separate test.)
- **Smoke is structural, story is narrative.** Smoke is driven by the topology
  (cover every node and every edge, once). Story is driven by user scenarios and
  chases neither coverage nor topological completeness.
- **CI routing follows the family:** all smokes run in remote CI _and_ pre-push;
  stories run at pre-push only, because they are slower/more brittle realism
  showcases that would destabilise remote CI.

Every e2e — node smoke, edge smoke, or story — **must have a row in the e2e
registry** (`tests/CONTRACT.md`) before or with its implementation, carrying
a "why it must be e2e" justification, its family/kind, and its run target.

## 4. Authorship and approval (process axis)

The layer determines **who designs the test and whose approval it needs**.

| Family · layer               | Who designs it                                                                                               | Approval                                              | Recorded where                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------ |
| functional · **unit**        | The agent, autonomously.                                                                                     | None required.                                        | Code only.                                       |
| functional · **integration** | Co-designed **interactively** with the maintainer.                                                           | Maintainer agrees the subsystem boundary and doubles. | Code + PR discussion.                            |
| functional · **smoke**       | Proposed by the agent from the node/edge topology; maintainer confirms the row.                              | Maintainer confirms the registry row.                 | `tests/CONTRACT.md`.                             |
| BDD · **story**              | **The maintainer authors the scenario as markdown**; the agent translates that `.md` into a Playwright spec. | Explicit maintainer confirmation of the `.md`.        | The `.md` scenario itself + `tests/CONTRACT.md`. |

## 5. Classification procedure

Ask the **human** questions in order; the first "yes" fixes the layer. Then
**confirm** with the runtime lens.

1. Does the behaviour only emerge from **two independently deployed subsystems
   coordinating over their real interface**, expressed as a **user scenario**,
   OR is it the **realism of a node/edge in the deployment graph**?
   → **e2e** (then pick node smoke / edge smoke / story per §3).
2. Otherwise, are the variables under test owned by **one subsystem** (outside
   collaborators may be doubled)? → **integration**.
3. Otherwise, is it a **pure, single-module function**? → **unit**.

**Runtime confirmation** (should agree; it is why the layers also differ in
cost): e2e needs a real cross-process/network boundary; integration needs an
in-process stateful runtime or platform/IO doubles; unit needs nothing.

**Safeguard — ambiguity rounds up.** If a test is genuinely ambiguous between
two layers, choose the **higher-human-involvement** layer (unit↔integration →
integration; integration↔e2e → e2e). Because approval rights are bound to the
layer (§4), misclassifying _downward_ would bypass human review. **If the human
and runtime lenses disagree, stop and resolve it with the maintainer — do not
self-classify.**

---

## 6. Naming and directory convention

### Directory — functional lives close, BDD lives apart

Organise by **family/layer**, not by "is it e2e". functional tests sit next to
what they verify; story tests sit in one dedicated tree.

| Family · layer              | Home                                                                                                                                            | Rationale                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| functional · unit           | co-located with the module, in the package `src/`                                                                                               | a unit is a module concern                                                                               |
| functional · integration    | co-located with the module (`src/`) or the owning package's `test/`; **cross-subsystem** integration lives in **repository-level `tests/int/`** | an integration test is a subsystem concern; when it spans two subsystems it belongs to no single package |
| functional · **node smoke** | **inside that node's app package**, `apps/<node>/test/e2e/`                                                                                     | a node smoke belongs to the node it proves                                                               |
| functional · **edge smoke** | **repository-level `tests/edge/`**                                                                                                              | an edge spans two nodes; it belongs to no single package                                                 |
| story                       | **repository-level `tests/sdd/`**                                                                                                               | a story is a cross-product scenario, kept apart from functional                                          |

### File name — one fixed-position type token

```
<kebab-subject>.<token>.<tool-ext>
```

- **`<token>`** — exactly **one**, fixed position, from a closed set:
  `unit` · `int` · `smoke` · `story`. Tokens never stack; smoke's node-vs-edge
  sub-kind is expressed by **directory**, not by a second token.
- **`<tool-ext>`** — the runner: **`test.ts`** = Vitest, **`spec.ts`** =
  Playwright.
- **`<kebab-subject>`** — the naming subject, in kebab-case. It names **what the
  test is anchored to** (§3), never _how it is transported_. A transport/protocol
  (`ws`, `http`) must **not** appear in the name — it is an implementation detail
  of the interaction, not the identity of the thing under test.

Subject by kind: unit → module (`room-state`); integration → subsystem feature
(`room-object`); node smoke → the node (`backend`); edge smoke → **the node
pair** `<nodeA>-<nodeB>` (`frontend-backend`); story → scenario
(`two-people-estimate`).

| Family · layer | Example file                        | Runner     |
| -------------- | ----------------------------------- | ---------- |
| unit           | `room-state.unit.test.ts`           | Vitest     |
| integration    | `room-object.int.test.ts`           | Vitest     |
| node smoke     | `backend.smoke.spec.ts`             | Playwright |
| edge smoke     | `frontend-backend.smoke.spec.ts`    | Playwright |
| story          | `two-people-estimate.story.spec.ts` | Playwright |

### The edge abstraction — one edge, one file, N facets

An **edge is the topological fact that two subsystems coordinate** — nothing
more. Between any pair of nodes there is **exactly one edge**, regardless of how
many interfaces, protocols, or functions ride over it. Health checks, the
realtime channel, HTTP, WS — these are **not separate edges**; they are
different **interactions over the same edge**. Interface/protocol/function
therefore belong to the _contents_ of an edge, not to its identity:

- **Identity → subject.** The edge's name is the node pair only. Never encode a
  protocol (which mislevels — WS _is_ HTTP) or a function (which multiplies one
  edge into many and breaks "one smoke per edge").
- **Contents → facets inside the file.** The distinct things an edge carries are
  **facets**, expressed _within_ the single edge-smoke file.

**One edge = one smoke file.** When an edge carries several interactions whose
**failure modes are independent** (a regression can redden one while the other
stays green — e.g. the HTTP proxy route vs. the WS+DO channel share no code
path), cover them as **multiple independent facets in that one file**. When the
interactions are not independent (one subsumes the other), keep only the
**most complete** one.

**In-file segmentation (Playwright):**

- Top-level `describe` = the **edge identity** (`edge: frontend ↔ backend`).
- **One `test()` per independent failure surface** (facet). Independent facets
  must be **separate `test()` cases, not multiple `expect`s in one test** — a
  test aborts at its first failed assertion, which would mask an independent
  facet's signal. Separate tests let each facet go red/green on its own; a
  common-cause outage simply reddens them together.
- `test.step()` = stages **within** one facet (for locating a failure), never a
  device for splitting independent facets.
- Share only immutable setup (base URL via config/fixture); no facet may leave
  mutable state that another facet depends on.

### Story: markdown is the source, spec is generated

A story is **not** Gherkin — there is no feature grammar or shared step library.
Instead a human-authored **markdown scenario is the script**, and the agent
generates the Playwright spec from it through an XState-orchestrated pipeline
(see `docs/sdd.md` for the full contract). The directory is `tests/sdd/`
(**s**tory / **s**tate driven):

- `tests/sdd/<scenario>/<scenario>.md` — the maintainer-authored, confirmed
  scenario (the source of truth; Chinese prose, no implementation detail).
- `tests/sdd/uc/uc-*.ts` — the use-cases the story decomposes into (the
  first-class, independently-testable units); shared UI helpers live in
  `tests/sdd/utils/`.
- `tests/sdd/<scenario>/machine.ts` — an XState orchestration machine whose
  nodes are test-level checkpoints and whose transitions are use-cases.
- `tests/sdd/generated/<scenario>.story.spec.ts` — the generated Playwright
  spec. **Committed**, with a `GENERATED FILE — DO NOT EDIT BY HAND` header.
  Regenerate with `pnpm test:story:gen` when the `.md`, machine, or UCs change.

---

## 7. This repository

### Subsystems (nodes) and edges

| Node (deployable)   | Kind                            | e2e?                                         |
| ------------------- | ------------------------------- | -------------------------------------------- |
| `packages/app-core` | Shared domain library           | **No** — not a node; unit + integration only |
| `apps/cloudflare`   | Backend Worker + Durable Object | node smoke + edges                           |
| `apps/frontend`     | Web app                         | node smoke + edges                           |
| `apps/self-hosted`  | Alternative backend server      | node smoke (if a supported target)           |

Edges (topological — one per node pair, regardless of how many interactions
ride over it):

- `frontend ──▶ cloudflare` — one edge; facets: HTTP `/api` health proxy **and**
  WS `/ws` realtime channel (independent failure modes → two facets in one file).
- `frontend ──▶ self-hosted` — one edge (if supported).

The concrete node smoke / edge smoke / story e2e set and its CI-vs-local routing
is the registry in `tests/CONTRACT.md`.

### Layer homes and conventions

Per §6, applied to this repo:

| Family · layer | Home                                                                                        | Runner via                                  |
| -------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| unit           | `packages/app-core/src/**/*.unit.test.ts` (co-located)                                      | `pnpm test` (`pnpm -r test`, Vitest)        |
| integration    | app-core: `src/**/*.int.test.ts` (co-located); apps: `<app>/test/**/*.int.test.ts`          | `pnpm test`                                 |
| node smoke     | `apps/<node>/test/e2e/<node>.smoke.spec.ts`                                                 | `pnpm test:smoke` / `test:e2e` (Playwright) |
| edge smoke     | `tests/edge/<nodeA>-<nodeB>.smoke.spec.ts` (facets inside)                                  | `pnpm test:smoke` / `test:e2e`              |
| story          | `tests/sdd/<scenario>/<scenario>.md` + UCs → `tests/sdd/generated/<scenario>.story.spec.ts` | `pnpm test:e2e` (pre-push only)             |

Notes:

- `app-core` co-locates **both** unit and integration in `src/` (its build
  already tolerates co-located `*.test.ts`); the app packages
  (cloudflare/self-hosted) keep integration under `test/`, out of the build
  `rootDir`. The distinction is the **token**, not the directory.
- Playwright runs two projects: `smoke` (node + edge; `pnpm test:smoke`, for CI
  **and** pre-push) and `story` (`tests/sdd`; pre-push only). `pnpm test:e2e`
  runs both.
- The frontend **room playground** (`apps/frontend/src/playground/`, opened with
  `pnpm --filter @agile-poker/frontend dev:playground`) is a **dev-only** visual
  preview of `RoomScreen` over a mock WebSocket backed by the real pure reducer.
  Its `playground.html` entry is compiled by `vite build` (so it is part of the
  `pnpm build`/`pnpm verify` output), but it is **not a test tier**: nothing in
  `verify` or CI exercises or asserts against it. See
  `apps/frontend/src/playground/README.md`.

### Current placement (informative)

- **unit** (`*.unit.test.ts`, co-located in `packages/app-core/src`):
  `room-state`, `vote`, `schema`.
- **integration** (`*.int.test.ts`): app-core — `use-cases`, `room-store`,
  `routes/handle-request`, `routes/graphql`, `use-cases/health` (co-located in
  `src`); `apps/cloudflare/test/room-object` (DO boundary, multi-socket
  broadcast); `apps/frontend/src/hooks/useRoomSocket` (doubled WebSocket);
  `apps/self-hosted/test/sqlite-store`.
- **smoke**: node — `apps/cloudflare/test/e2e/backend.smoke.spec.ts`,
  `apps/frontend/test/e2e/frontend.smoke.spec.ts`; edge —
  `tests/edge/frontend-backend.smoke.spec.ts` (facet ① HTTP proxy, facet ②
  WS room). See `tests/CONTRACT.md`.
- **story**: `two-people-estimate` (invite link) and `two-people-estimate-by-code`
  (room code), each with an auto-generated negative — generated into
  `tests/sdd/generated/`. See `tests/CONTRACT.md`.
