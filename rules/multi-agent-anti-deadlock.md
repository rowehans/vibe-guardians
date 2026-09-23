# Universal Rule: Multi-Agent Anti-Deadlock & Priority Queuing

## Core Principle

When multiple AI coding assistants operate concurrently in a shared repository, **agents must never engage in passive prompt waiting when encountering shared file locks**. Scope collisions must be resolved deterministically through priority queues and asynchronous inter-agent notices.

## Prohibited Behaviors

1. **Passive Waiting Loops**:
   - An agent must NEVER stall, pause execution in silence, or poll fruitlessly waiting for another agent to release a file lock.
2. **Stalling Completed Work**:
   - If a lower-priority task (e.g. P2) has already verified its implementation and tests pass, a higher-priority task must not block its closure. The ready task must close immediately to free shared resources.
3. **Uncoordinated Shared File Edits**:
   - Modifying entrypoints, lockfiles, or workboards while another agent has an active lease on them is prohibited.

## Anti-Deadlock Protocol

1. **Proactive Queueing**:
   - When a required file is locked by another agent, the agent must immediately enqueue its request using priority order (`P0 > P1 > P2 > P3`):
     ```bash
     agent-coord enqueue --id TASK-ID --agent AgentName --priority P1 --scope src/app.js --summary "Fix reason"
     ```
     or claim with `--queue`.
2. **Priority to Ready Tasks**:
   - Any task with 100% passing tests and completed evidence must execute `finish` immediately, releasing resources for queued workers.
3. **Asynchronous Inter-Agent Notices**:
   - Inter-agent coordination hurdles and handoffs must be documented in `notices.md` (e.g. `## To: AgentA, AgentB`) to break mutual expectation loops asynchronously.
