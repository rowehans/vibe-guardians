---
name: design-freeze-guardian
description: Stop AI assistants from silently redesigning your app. Freeze design tokens, color palettes, typography, spacing and critical UI copy in a fail-closed test suite, so a visual or copy change fails unless an authorized baseline entry allows it. Use during refactors and bug fixes with any assistant (Cursor, Claude Code, Codex, Copilot, Windsurf, Antigravity).
---

# Design Freeze Guardian Protocol

Use this skill to enforce design freeze invariants on projects where visual aesthetics, brand colors, typography, or UI copy must be strictly protected against AI drift.

## Core Rules for AI Assistants

1. **Strict Prohibition on Visual Modifications**:
   - Never modify colors, gradients, font sizes, margins, padding, or user-facing copy unless explicitly requested by the user.
   - If fixing a backend bug or state logic, restrict code changes strictly to functionality without touching UI styling.

2. **Automated Verification**:
   - Before completing tasks, run the design freeze test suite:
     ```bash
     node --test test/design-freeze.test.js
     ```
   - If the test fails, a visual baseline was altered without authorization. Revert visual changes to restore the baseline hash.

3. **Legitimate Design Changes**:
   - If the user explicitly requested a UI change, update `baseline-config.json` by adding an entry to `authorizedExceptions` with the task ID and user's approval quote.
