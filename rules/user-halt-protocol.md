# Universal Rule: User Halt & Zero Auto-Next Protocol

## Core Principle

When an autonomous or semi-autonomous AI coding assistant receives an explicit instruction from the user to stop fixing errors, finish the current task only, or proceed to deployment, **the agent must immediately freeze backlog intake and cease auto-claiming subsequent tasks**.

## Prohibited Behaviors

1. **Backlog Runaway**:
   - Never automatically claim or pick up the next available task from task queues (`agent-tasks.json`, issue trackers) after a user halt command.
2. **Speculative Issue Hunting**:
   - When asked to deploy or stop, do NOT search for new speculative bugs, audit findings, or tangential improvements.
3. **Ignoring Deployment Directives**:
   - If the user commands "deploy now", "ship it", or "stop fixing and publish", do not stall by inventing additional refactoring steps.

## Halt Execution Sequence

Upon receiving a stop or publish directive:
1. **Immediate Backlog Freeze**: Halt selection of new tasks.
2. **In-Flight Task Completion**: Drive only the currently claimed task to verified completion, running tests and recording evidence.
3. **Graceful Subagent Consolidation**: Ensure active specialist workers complete cleanly without leaving dangling unmerged files.
4. **Quiet Wait**: Deliver the requested output or deployment verification and wait quietly for further explicit user instructions.
