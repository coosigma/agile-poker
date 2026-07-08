# tests/sdd

Artifacts for the **story** e2e family: user stories (`<story>/<story>.md`) and
the use-cases, orchestration machines, and generated Playwright specs derived
from them.

- **User stories** (`<story>/<story>.md`) — Chinese prose, the source of truth.
- **Everything else** (`uc/`, `<story>/machine.ts`, `generated/`, `utils/`) is
  generated or hand-written support code, held to review.

The pipeline (how a story becomes generated specs) is documented in
[`../../docs/sdd.md`](../../docs/sdd.md).
