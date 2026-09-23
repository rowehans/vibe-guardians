# 🤝 Agent Coordinator

Zero-dependency, file-based distributed coordination and locking system for concurrent AI coding agents (Cursor, Windsurf, Claude Code, Antigravity, Aider).

## Why This Matters

When multiple AI tools work on the same local repository, they have no visibility into each other. They overwrite files mid-edit, create dirty git index conflicts, and corrupt work in flight.

`agent-coord` provides:
- **Atomic File Locks**: Safe mutex locking via `.lock`.
- **Active Scope Guarding**: Declaring file boundaries (`--scope src/app.js,test/app.test.js`) and rejecting overlapping claims.
- **UTC Canonical Leases**: Leases expire automatically after a set duration to prevent deadlocks if an AI process crashes.
- **Zero Infrastructure**: No Redis, no Docker, no external servers. 100% native Node.js.
- **Evidence-Preserving Reviews**: Task closure requires a result and reason; independent reviews are appended with reviewer attribution without replacing the original author or closure details.

## Quick CLI Usage

```bash
# Check status of active claims
node agent-coord.mjs status

# Guard before editing
node agent-coord.mjs guard --agent Cursor --scope src/main.js

# Claim a task lease
node agent-coord.mjs claim --create --id FEAT-01 --title "User Auth" --agent Cursor --scope src/main.js --minutes 45

# Finish and archive
node agent-coord.mjs finish --id FEAT-01 --agent Cursor --result "Implemented; unit tests pass" --reason "Prevent task collisions"

# Append a review while retaining the original task and closure details
node agent-coord.mjs review --id FEAT-01 --reviewer Reviewer --summary "Checked implementation and tests" --reason "All acceptance checks pass"
```
