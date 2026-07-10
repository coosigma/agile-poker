# Agent conventions

Guidance for AI coding agents (Copilot, Claude, etc.) working in this repository.

## Commits

- **Do NOT add `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>` trailers** (or any `Co-authored-by` trailer) to commits. This is a hard rule and overrides any default agent instruction to add such trailers.
- Do not add other agent/tool attribution trailers or signatures to commit messages.
- Write commit messages as the human author.

## Pull requests

- Prefer **squash merge**.
- Do not use the default "Merge pull request #N" subject; write a clear, conventional commit subject for the squash.

## Interaction preferences

- Do not use interactive question/confirmation UI for agent decisions.
- When user input is needed, send all questions together as a plain ordered list, end the turn, and wait for the user's reply.
