---
name: agent-coordinator
description: Multi-Agent coordination and file-lock protocol for preventing collisions when multiple AI coding assistants work concurrently in the same repository.
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
     node skills/agent-coordinator/scripts/agent-coord.mjs finish --id <TASK-ID> --agent <YourAgentName> --result "Verified passing unit tests"
     ```
   - If you need to stop or unblock others:
     ```bash
     node skills/agent-coordinator/scripts/agent-coord.mjs release --id <TASK-ID> --agent <YourAgentName>
     ```
