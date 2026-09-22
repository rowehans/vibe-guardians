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
3. Copy `template/theme.sample.css` next to it so the suite runs green immediately, then replace it with your real token file (CSS custom properties, Tailwind theme output, a tokens dump).
4. Re-hash your file and paste the value into `designTokens.expectedSha256`:
   ```bash
   node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync('theme.sample.css','utf8').replace(/\r\n/g,'\n'),'utf8').digest('hex'))"
   ```
5. Run it, and wire it into your gate:
   ```bash
   node --test test/design-freeze.test.js
   ```

## Fail-closed, on purpose

The suite **fails** when it cannot verify: no baseline, an unconfigured baseline, a target file that is missing, an exception without a real authorization. It never returns early and never skips. A guardian that passes because it could not look is worse than no guardian, because it certifies a freeze that is not happening — that failure mode existed in this template's first version, and `test/design-freeze-template.test.js` in this repository now pins it shut.

## Windows note

Line endings are normalised before hashing: git may check the same file out as LF or CRLF (`core.autocrlf`), and a baseline that only matches one of them produces false failures, which teach people to distrust the guardian. Normalising does not weaken the freeze — any real content change still differs.

## Want the richer version?

This template freezes one token file by hash. This repository's own freeze — `test/repo.design-freeze.test.js` — works at token level instead (a palette role, a gradient order, a copy string, per asset and pinned to file:line) so ordinary editing stays free while identity drift fails. Use it as the reference when hashing a whole file becomes too blunt.
