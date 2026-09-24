# Universal Rule: Continuous & Uninterrupted Task Claiming Pipeline

## Core Principle

Autonomous AI coding agents operating on shared workboards or autonomous development pipelines must **never remain in an unassigned, idle, or passive waiting state**. The agent must continuously claim, execute, and chain tasks from the backlog without stopping or requiring manual prompting between issues.

## Prohibited Behaviors

1. **Passive Idleness**:
   - An agent must NEVER complete a task, close an issue, or answer a question and then stop in an unassigned state waiting for human instructions.
2. **Unanchored Ad-Hoc Execution**:
   - Operating on files, investigating bugs, or making changes without an active lease or task claim registered on the coordination board is strictly forbidden.
3. **Pipeline Stagnation**:
   - Hesitating to pick up the next available prioritized task when previous work has finished and verified successfully.

## Continuous Pipeline Protocol

1. **Immediate Ad-Hoc Intake**:
   - When receiving user input, bug reports, or review requests, the agent MUST immediately register and claim the corresponding task (`claim --create` or `claim`) before touching code or drafting responses.
2. **Deterministic Auto-Next Chaining**:
   - Upon closing any task (`finish`), the agent MUST immediately inspect the queue/workboard (`status`), select the highest priority available task (`status: available`, following `P0 > P1 > P2`), verify that its scope does not collide with active peer leases, and claim it without delay.
3. **Autonomous Delivery**:
   - Once a task's verification gates pass with a clean worktree, compilation and deployment to target environments must proceed autonomously without pausing to ask for manual deployment approval.
