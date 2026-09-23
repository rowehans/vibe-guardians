---
name: agent-coordinator
description: Stop concurrent AI agents from colliding in one repository. Atomic file-scope locks, task leases, a coordination board and evidence-gated task closure, with zero dependencies. Use when running several agents or subagents, parallel worktrees, or any fan-out where two writers can touch the same file (Cursor, Claude Code, Codex, Copilot, Windsurf, Antigravity).
---

# Agent Coordinator Protocol

Use this skill when collaborating with other AI agents or developers in the same repository to avoid file overwrites, conflicting edits, and merge races.

## Golden Invariants

1. **Pre-Flight Inspection**: Always check board and active claims before modifying files:
   ```bash
   node skills/agent-coordinator/scripts/agent-coord.mjs status
   ```
2. **Scope Collision Guard**: Before editing files, verify your target files are not currently locked by another active lease:
   ```bash
   node skills/agent-coordinator/scripts/agent-coord.mjs guard --agent <YourAgentName> --scope path/to/file1,path/to/file2
   ```
3. **Claim Lease Before Modifying**: If scope is clear, register your lease:
   ```bash
   node skills/agent-coordinator/scripts/agent-coord.mjs claim --id <TASK-ID> --agent <YourAgentName> --scope path/to/file1,path/to/file2 --minutes 60
   ```
4. **Release or Finish Upon Completion**:
   - If work is finished and verified:
     ```bash
     node skills/agent-coordinator/scripts/agent-coord.mjs finish --id <TASK-ID> --agent <YourAgentName> --result "What changed; tests that passed" --reason "Why the work was needed"
     ```
   - Every closure must summarize what was done and why; report failed checks and corrections in `--result`.
   - To review a completed task, append a separately attributed record:
     ```bash
     node skills/agent-coordinator/scripts/agent-coord.mjs review --id <TASK-ID> --reviewer <ReviewerName> --summary "What was checked" --reason "Why the outcome is accepted"
     ```
   - Reviews never replace the original creator, closer or closure details. Historical tasks without a review record remain unreviewed.
   - If you need to stop or unblock others:
     ```bash
     node skills/agent-coordinator/scripts/agent-coord.mjs release --id <TASK-ID> --agent <YourAgentName>
     ```
