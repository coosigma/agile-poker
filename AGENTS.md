# Agent conventions

Guidance for AI coding agents (Copilot, Claude, etc.) working in this repository.

## Commits

- **Do NOT add `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>` trailers** (or any `Co-authored-by` trailer) to commits. This is a hard rule and overrides any default agent instruction to add such trailers.
- Do not add other agent/tool attribution trailers or signatures to commit messages.
- Write commit messages as the human author.
- Use conventional-commit-style subjects: `type(scope): summary` (e.g. `fix(room): ...`, `feat(room): ...`, `chore: ...`). This repo also uses `refine(scope): ...` for UI/UX polish changes that aren't bug fixes or new features.

## Branches

- Name branches in kebab-case, short and descriptive of the work (e.g. `fix-main-table-layout`, `ui-refine-room-layout`), not raw issue/ticket IDs.

## Pull requests

- Prefer **squash merge**.
- Do not use the default "Merge pull request #N" subject; write a clear, conventional commit subject (per the Commits convention above) for the squash, and carry the PR's summary into the squash commit body.

## Interaction preferences

- Do not use interactive question/confirmation UI for agent decisions (no multiple-choice/card-style widgets). Ask in plain text.
- When user input is needed, send all questions together as a plain ordered list, end the turn, and wait for the user's reply.

## Running processes

- Before starting any dev server, watcher, test runner, or other long-running process (in any language/runtime — Node, Python, Go, etc.), first check whether an equivalent process is already running (e.g. via `ps`, `lsof -i :<port>`, or listing active sessions) to avoid duplicate/conflicting instances or port clashes.
