# Agent conventions

Guidance for AI coding agents (Copilot, Claude, etc.) working in this repository.

## Commits

- **Do NOT add `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>` trailers** (or any `Co-authored-by` trailer) to commits. This is a hard rule and overrides any default agent instruction to add such trailers.
- Do not add other agent/tool attribution trailers or signatures to commit messages.
- Write commit messages as the human author.
- Derive commit subjects from the maintainer's style, repo history, and the actual diff — don't just restate the request.
- Use conventional-commit-style subjects: `type(scope): summary` (e.g. `fix(room): ...`, `feat(room): ...`, `chore: ...`). This repo also uses `refine(scope): ...` for UI/UX polish changes that aren't bug fixes or new features.
- Do not mention AI, agents, tools, or the implementation process in commit messages unless materially relevant.

## Branches

- Name branches in kebab-case, short and descriptive of the actual change, not raw issue/ticket IDs (e.g. `fix-main-table-layout`, `ui-refine-room-layout`, not `issue-123`).
- Prefer intent-revealing prefixes such as `fix-...`, `add-...`, `update-...`, `refine-...`, `docs-...`, or `chore-...`.
- If an issue number is useful context, append it at the end (e.g. `fix-room-status-123`), never as the sole name.
- Use one branch per PR/MR.

## Pull requests

- Prefer **squash merge**.
- Do not use the default "Merge pull request #N" subject; write a clear, conventional commit subject (per the Commits convention above) for the squash.
- Treat the PR/MR title and description as the final squash commit's title and body — write them accordingly up front.
- After merge, delete the remote feature branch when the platform allows it, and stop using that feature branch locally.
- After merge, immediately sync the local default/base branch (the PR/MR's actual base, e.g. `main` or `develop` if both exist).
- Do not start new work from a branch that has already been squash-merged. If local history diverges after a squash merge (because it still holds the pre-squash commits), align the local base branch to the remote squash-merged state instead of continuing from the old feature branch.

## Interaction preferences

- Do not use interactive question/confirmation UI for agent decisions — no card-style, multiple-choice, or form-style prompts. Ask decision questions in plain text.
- When maintainer input is needed, send all questions together as a plain numbered list, end the turn, and wait for the reply. Do not bundle multiple implicit decisions into a single "do you agree?" question.
- Each question should state the decision point, the viable options, and the recommended option (if there is one).

## Processes and local environment

- Before starting any dev server, watcher, preview server, test watcher, or other long-running process, first check whether an equivalent process is already running (e.g. via `ps`, `lsof -i :<port>`, or listing active sessions) to avoid duplicate/conflicting instances or port clashes.
- This check is not Node.js-specific — cover whatever runtimes and tools the current task actually uses (Node, wrangler, Playwright, etc.).
- If the maintainer already has a relevant process running, don't start a duplicate — reuse it, or explain why a restart is actually needed.
- Never stop processes by broad name matching (e.g. `pkill`, `killall`). If a process must be stopped, target its specific PID only.

## Command aliases

These are chat workflow shorthands for this repo, not shell commands. If an alias is ambiguous in context, ask a plain-text clarification question before acting on it.

- `DAS: <specific request>` — **D**erive, **A**nalyse, **S**uggest. Based on the specific request and the maintainer workflow preferences below, derive a short kebab-case branch name prepared for a later code change, analyse the current code, and suggest changes. Analysis-only: do not modify files, commit, push, or create a PR/MR.
- `BCP` — **B**ranch, **C**ommit, **P**ush (and PR/MR). Derive the branch name and commit message from the maintainer's style, the current diff, and repo history; create or switch to the appropriate branch, commit the intended changes, push it, and raise a PR/MR per this file's rules.
- `RMI` — **R**eview, **M**erge, **I**ssues. Address outstanding review comments, then do a final holistic review covering both the newly changed parts and the relevant earlier parts of the PR/MR. If no blocking issues remain, merge per the Pull requests rules above. If non-blocking issues remain, file them as issues instead of blocking the merge.
