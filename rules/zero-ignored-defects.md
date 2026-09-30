# Universal Rule: Zero-Ignored Defects & Immediate Triage Protocol

## Core Principle: The "Walk-By" Anti-Pattern

Autonomous AI coding agents must **never ignore, bypass, or abandon defects discovered in flight**. 

### Why This Rule Exists (The "Walk-By" Failure Mode)
A common and catastrophic failure mode of AI coding agents is the **"Walk-By" Syndrome**: While working on Task A (e.g. refactoring an endpoint or adding a feature), the agent encounters an unrelated bug, an unhandled rejection, a failing test assertion, or a UI glitch. Instead of handling it, the agent thinks *"that's not part of Task A"* and simply continues working on Task A. 
**The fatal outcome:** Once Task A is completed, the discovered defect is completely forgotten. It is never logged on the board, never resolved, and vanishes into the conversational ether until it causes an outage in production.

**Strict Prohibition:** Agents are strictly forbidden from discovering a defect and walking past it. Every single defect discovered by an agent must be acted upon immediately.

## Prohibited Behaviors

1. **Silent Bypass & Walk-By Amnesia**:
   - Spotting an error, crash vector, or test failure during inspection or execution, and proceeding with other work without repairing it or logging it.
2. **Ephemeral TODO Comments**:
   - Leaving passive `// TODO: fix this` or `// FIXME` comments in source code without creating a corresponding tracked issue or workboard task.
3. **Internal Chain-of-Thought Hiding**:
   - Noting a bug in internal reasoning or chat messages (`"I noticed X is broken, but continuing with Y"`) without creating a formal task on the workboard.
4. **Diffusion of Responsibility**:
   - Assuming that another developer, subagent, or subsequent session will independently discover and fix the defect.

## Immediate Triage Protocol (The Two Valid Paths)

Upon encountering any defect or anomaly, the agent MUST immediately select and execute one of two paths:

### Path A: Fix Now (In-Flight Surgical Remediation)
- **When to apply**:
  - The defect falls within the file scope already claimed by the active task.
  - Or the defect is a surgical, low-risk fix (e.g., missing null-check, syntax typo, missing import, outdated test assertion) that can be safely resolved without altering architecture or colliding with other active agents.
- **Requirements**:
  - Apply the minimal surgical diff that resolves the defect.
  - Add or update regression unit tests to prevent recurrence.
  - Document the remediation in the task's evidence payload (`changes`, `checks`).

### Path B: Task Now (Immediate Workboard Registration)
- **When to apply**:
  - The defect requires changes outside the active task's file scope.
  - The target files are actively locked by another agent (`status: in_progress`).
  - The defect is structural, complex, or requires architectural redesign, database migration, or extensive test suites that would derail the active task.
- **Requirements**:
  - Immediately create a formal task on the coordination board:
    ```bash
    node scripts/agent-coord.mjs claim --create --id <NEW-ID> --priority <P0|P1|P2|P3> --title "<Descriptive Title>" --scope "<affected files>" --summary "<Exact file, line, observed behavior, root cause, reproduction steps>"
    ```
  - Categorize priority strictly by severity:
    - **P0**: Application crashes, data loss/corruption, infinite loops, critical auth/security breaches.
    - **P1**: Broken functional flows, balance/currency discrepancies, sync failures, severe regressions.
    - **P2**: UI flaws, accessibility defects (touch target < 44px), console warnings, performance drops.
    - **P3**: Minor technical debt, dead code removal, cosmetic optimizations.
