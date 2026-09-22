# CLAUDE.md

See [`AGENTS.md`](AGENTS.md) — it is the single source of truth for agents working in this repository (build/test commands, conventions, non-negotiable rules, definition of done). This file exists only so tools that look for `CLAUDE.md` are routed there.

Quick version:

```bash
npm install && npm test    # the whole gate; it must be green before you finish
```

- Fail closed: never weaken an assertion to make a suite pass.
- Never edit the license pin to make `test/license-integrity.test.js` pass.
- No private data or absolute machine paths in tracked files; zero new dependencies.
