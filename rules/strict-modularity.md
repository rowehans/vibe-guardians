# Universal Rule: Strict Modularity & Zero Monolithic Entrypoints

## Core Principle

As codebases scale under AI-assisted development, **agents must strictly preserve modular boundaries and never dump business logic, custom state machines, or extensive UI templates into top-level composition entrypoints**.

## Prohibited Behaviors

1. **Entrypoint Bloat**:
   - Never place domain calculations, state management machines, or massive JSX/HTML blocks directly into the application root (e.g. `App.jsx`, `index.js`, `main.ts`).
2. **Untested Inline Logic**:
   - Adding inline helper functions directly within UI components instead of pure, testable domain utilities is prohibited.
3. **Monolithic Accumulation**:
   - Continuously growing a single file beyond its orchestration scope creates high-contention bottlenecks for multi-agent workflows.

## Modular Architecture Standard

1. **Pure Domain Logic**: Mathematical formulas, business rules, and validation algorithms must reside in dedicated domain modules (`domain/`) tested with pure unit tests.
2. **State & Orchestration**: Custom hooks, state machines, and data coordination logic belong in dedicated hooks (`hooks/`).
3. **UI Components**: Visual panels, forms, and dialogs must reside in isolated component directories (`components/`).
4. **Dedicated Test Parity**: Every newly extracted or authored module must be accompanied by its dedicated unit test suite.
