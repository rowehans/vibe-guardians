# 🎨 Design Freeze Guardian

A fail-closed cryptographic test suite preventing AI coding assistants from silently drifting your UI design, colors, CSS tokens, and brand copy.

## The Problem

Every developer using AI tools (Cursor, Claude Code, Copilot, Windsurf) knows this frustration:
> *"I asked the AI to fix an authentication bug in the backend, and it completely redesigned my buttons, changed my brand gradient, and re-wrote my marketing headlines."*

## The Solution

`design-freeze-guardian` freezes your visual tokens (CSS variables, Tailwind colors, layout themes, and critical copy) using cryptographic hashes verified in your standard test runner:
- If an AI agent touches styling without authorization, `npm test` immediately breaks fail-closed.
- Changes can only pass when an authorized exception is declared in `baseline-config.json`.

## Quick Setup

1. Copy `template/design-freeze.test.js` to your `test/` directory.
2. Copy `template/baseline-config.json` to your project root.
3. Compute your initial design tokens hash and add it to `baseline-config.json`.
4. Run:
   ```bash
   node --test test/design-freeze.test.js
   ```
