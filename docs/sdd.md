# sdd — the story-/state-driven test pipeline

How a maintainer-approved user story becomes runnable Playwright specs in this
repo — deterministically and reviewably (see [`../TESTING.md`](../TESTING.md) §3
and [`../tests/CONTRACT.md`](../tests/CONTRACT.md)).

`s` = **story** _and_ **state**. A user story is realized as a composition of
small, independently-testable **use-cases (UCs)** wired into an **XState**
orchestration machine, from which journeys are enumerated. The machine is a
**test-side** machine: its nodes are UCs, not app components. Gherkin/Cucumber is
a separate system and is **excluded**.

## Pipeline

```
(1) tests/sdd/<story>/<story>.md      user story — authored and finalized. One story = one .md.
 |                                Contains NO negatives and NO implementation detail.
 v
(2) tests/sdd/uc/uc-*.ts              use-cases — the machine's node implementations. Each UC has an
 |                                explicit precondition (entry state) and postcondition (exit state).
 v
(3) tests/sdd/<story>/machine.ts      orchestration machine — nodes = UCs, edges = legal transitions.
 |                                `toState` goals and `guards` are derived from the story's prose.
 |  getShortestPaths + state coverage   (one shortest path per reachable state)
 v
(4) tests/sdd/generated/<story>.story.spec.ts   Playwright spec, codegen'd, header `Generated from …`.
```

Shared UI mechanics live in `tests/sdd/utils/*.ts` as plain **code utilities**
(page objects, waits) — not a Gherkin-style step layer. De-duplication happens by
reusing UCs and utils, never by sinking a case to integration.

## Creating a story (quickstart)

A story is authored as narrative — there is nothing to copy — you write the
narrative and grow the harness around it. To add one:

1. Write `tests/sdd/<story>/<story>.md` — the user story, pure prose (§"The story
   `.md` is pure narrative").
2. Author the UCs it needs in `tests/sdd/uc/uc-*.ts` (+ `uc/context.ts` for the
   shared story context) and this story's `machine.ts` (§Use-cases, §Orchestration
   machine).
3. Catalogue them in `tests/sdd/<story>/manifest.ts` and
   `negative-manifest.ts` (pure data — no Playwright).
4. Add a thin `tests/sdd/<story>/generate.mts` that calls `generateStory({…})`
   from `../lib/generate-story.mts` (import the manifest types from there too).
5. Run `pnpm test:story:gen` (auto-discovers the new folder) → specs land in
   `tests/sdd/generated/`. Review them, then `pnpm test:story` to run.

## The story `.md` is pure narrative

A story `.md`:

- is **not Gherkin** — no `Feature`/`Scenario`, no `Given`/`When`/`Then`;
- is **plain prose** told from the user's point of view;
- contains **no implementation detail** (no UC tables, no state tokens, no
  selectors, no enumeration config) and **no negative cases** — those are a
  codegen concern and live in generated code.

## Use-cases (UCs)

- One UC = one node/transition in the machine, in `tests/sdd/uc/uc-<kebab-action>.ts`.
- Each UC declares an explicit **precondition** and **postcondition**, so it runs
  standalone (setting up its own precondition) _and_ composes (one UC's
  postcondition satisfies the next's precondition).
- UCs are **shared across stories** — write each UC once and reuse it.

## Orchestration machine

- Nodes are **test-level macro-states** (not the app's screen enum).
- Edges are UC events.
- A **single macro-state track** is modeled per story; multi-actor aspects (e.g.
  two clients) are carried by the UC implementations, not the machine.
- Cyclic transitions must carry a **termination guard** (e.g. a bounded counter →
  a `final` state) so path enumeration terminates.

## Enumeration config (locked)

| Lever                      | Setting                                                    |
| -------------------------- | ---------------------------------------------------------- |
| Algorithm                  | **`getShortestPaths`** (`@xstate/graph`)                   |
| Target predicate `toState` | derived from the story's prose                             |
| Transition guards          | derived from the story's prose                             |
| Event alphabet / payloads  | not enumerated — events are the UC set                     |
| Depth / `stopWhen` bound   | not used (rely on per-cycle termination guards)            |
| Coverage criterion         | **state coverage** — one shortest path per reachable state |

## Negatives & review

- Negative cases are **auto-generated** (from invalid transitions or
  guards the app actually enforces), **not** written into the `.md`.
- **Everything generated is reviewed before commit** — UCs, negatives, and the
  `*.story.spec.ts`.
- **Negatives must be grounded in real behaviour.** Auto-generate a negative only
  for a guard the app actually enforces (verify against the source).

## Running & visualising

- `pnpm test:story` — headless run (pre-push / normal).
- `pnpm test:story:gen` — regenerate the specs from the story + machine + UCs.
  Runs `tests/sdd/lib/generate-all.mts`, which discovers every
  `tests/sdd/<story>/generate.mts` and runs it (drop-in: adding a story needs no
  script wiring; with no stories yet it is a clean no-op).
- `pnpm test:story:headed` — watch it drive real browser windows, slowed via
  `PW_SLOWMO=600`ms (opt-in; headless runs are unaffected).
- `pnpm test:story:ui` — Playwright UI Mode: timeline, per-step DOM snapshots.

## Selectors

Prefer **semantic** selectors — `getByRole` / visible text. Only if a selector
proves brittle, add a local `data-testid` to the app source and flag that source
change explicitly in review.

## Naming & layout

```
tests/sdd/
  lib/generate-story.mts           shared codegen core (all stories call this);
                                   also exports the UseCaseManifestEntry /
                                   NegativeScenario manifest types
  lib/generate-all.mts             discovers & runs each story's generate.mts
  utils/*.ts                       shared UI code utilities
  uc/context.ts                    story context + UseCase type
  uc/uc-*.ts                       positive UC building blocks (SHARED across stories)
  uc/negative/uc-*.ts              negative UCs (auto-generated, reviewed)
  <story>/
    <story>.md                     the user story (source of truth)
    machine.ts                     orchestration machine (nodes = UC checkpoints)
    manifest.ts                    this story's UC catalogue (may reuse shared UCs)
    negative-manifest.ts           this story's negative scenarios
    generate.mts                   thin config → calls lib/generate-story.mts
  generated/
    <story>.story.spec.ts          generated positive journey (state coverage)
    <story>.negative.story.spec.ts generated negative cases
```

Both generated specs use the `.story.spec.ts` token so the Playwright `story`
project (`tests/sdd/generated/**`) picks them up.

`manifest.ts` is a **pure-data catalogue**: `{ id, importName, importPath, from,
to, description }`. The generator reads the manifest, **never UC bodies**, so
codegen never imports Playwright.

> **Import extensions.** `manifest.importPath` is **extensionless** (consumed by
> the bundler / Playwright). Node-run codegen files (`*.mts`) use **explicit**
> `.ts` / `.mts` value imports. Never rewrite an import extension during codegen
> or token replacement.

## Poker specifics

Concrete facts for this repo (the mechanics above are general):

- **Story prose is Chinese.** Each `<story>/<story>.md` is plain Chinese prose
  from the user's point of view, opening with an HTML-comment 中↔英 terminology
  table for English readers. No implementation detail, no negatives.
- **Room macro-states.** The orchestration machine tracks a single room track:
  `anonymousHome → inRoomAsHost → linkShared → bothInRoom → votesCast →
revealed → cleared`. The multi-client aspect (host + teammate) is carried by
  the UC implementations, which hold both Playwright pages — the machine does
  not model actors. `startNewRound` is cyclic and carries a bounded round
  counter → `final` so enumeration terminates.
- **Grounded negatives.** Only auto-generate a negative for a guard the app
  actually enforces. The room-code door has no "wrong code" rejection (the
  backend treats every well-formed code as an existing room), so its grounded
  negative is the client-side **empty-code** guard, not a non-existent code.
- **Selectors.** The app renders i18n text and ships no `data-testid`; prefer
  `getByRole` / visible text. Only add a local `data-testid` to the frontend
  source if a selector proves brittle, and flag that source change in review.
