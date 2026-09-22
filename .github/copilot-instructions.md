# Copilot instructions

See [`AGENTS.md`](../AGENTS.md) — the single source of truth for agents working in this repository (commands, conventions, non-negotiable rules, definition of done).

Essentials:

- Run `npm install && npm test`; every suite must be green before you finish.
- Fail closed: never weaken an assertion to make a suite pass, and never re-pin `test/license-integrity.test.js` to the file on disk.
- Zero new dependencies, ESM only, Node 18+, native `node:test`.
- Never commit private data, personal contact details or absolute machine paths.
