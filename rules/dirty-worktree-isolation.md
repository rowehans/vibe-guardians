# Universal Rule: Dirty Worktree Isolation & Safe Multi-Agent Deploys

## Core Principle

In local workspaces shared across multiple AI coding assistants, **an agent must NEVER execute production builds or deployment commands while the worktree contains uncommitted, in-flight modifications outside its declared scope**.

## Prohibited Behaviors

1. **Building Unfinished Concurrent Edits**:
   - Never run build scripts (`npm run build`, `node build.js`, bundlers) if another agent is actively modifying source files. Bundling a dirty worktree packages half-written code and undeclared identifiers into production bundles.
2. **Deploying Blindly**:
   - Never trigger production releases without checking active leases and porcelain git status.
3. **Overlapping Entrypoint Modifications**:
   - Never edit shared configuration files or application manifest entrypoints concurrently without coordination.

## Pre-Build Isolation Gates

Before running any build or deployment command:
1. **Active Leases Audit**: Run `agent-coord status` to ensure no other agent holds an active in-flight lease touching files in the bundle.
2. **Porcelain Status Inspection**: Execute `git status --porcelain` to verify that modified files belong strictly to the current agent's claimed scope.
3. **Serialization**: If another agent is modifying core runtime code, wait for the active agent to verify, test, and release its lease before initiating a build.
