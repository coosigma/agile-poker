# docs — engineering documentation

Engineering documentation that is **not** user-facing product docs and **not** a
user story. User stories live as prose in `tests/sdd/<story>/<story>.md`; the
human testing spec is [`../TESTING.md`](../TESTING.md) and the e2e registry is
[`../tests/CONTRACT.md`](../tests/CONTRACT.md).

## Index

- [`sdd.md`](./sdd.md) — the story-/state-driven (sdd) test pipeline: how a user
  story `.md` becomes use-cases, an XState orchestration machine, and generated
  Playwright specs for the `story` e2e family.
