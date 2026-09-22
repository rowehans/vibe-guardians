# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, GitHub Copilot, Claude Code, Windsurf, Jules, Amp, Aider, goose, opencode, Zed, Devin, Junie, …) working **inside this repository**.

If you are an agent looking to *use* these guardians in someone else's project rather than contribute here, read [`README.md`](README.md) and [`llms.txt`](llms.txt) instead — this file is about changing this repo.

## What this repository is

`vibe-guardians` is a zero-runtime-dependency package of three **agent skills** plus their test templates and a local coordination CLI. Each skill encodes an anti-regression invariant that AI assistants routinely break:

| Skill | Invariant it enforces |
|---|---|
| `skills/design-freeze-guardian/` | Visual output, brand tokens and critical copy cannot drift unless an authorized baseline entry says they may |
| `skills/agent-coordinator/` | Two agents never edit the same files at once; a task is never "done" without evidence |
| `skills/ast-async-hygiene/` | No floating promises on mutations, no empty `catch` blocks swallowing failures |

Everything is plain Node: ESM, native `node:test`, no build step, no transpiler, no test framework.

## Build and test commands

```bash
npm install                                  # installs acorn + acorn-walk (the only two dependencies)
npm test                                     # every suite in test/*.test.js, including the repo-only ones
node --test test/license-integrity.test.js   # run a single suite while iterating
node --test test/repo.design-freeze.test.js  # this repository's own design freeze
node skills/agent-coordinator/scripts/agent-coord.mjs status   # coordination board
npm pack --dry-run                           # see exactly what would be published
```

There is no lint step and no bundler. `npm test` is the whole gate, and it must be green before you finish.

## Conventions

- **ESM only.** `"type": "module"`, `import`/`export`, `node:` prefix on builtins. No CommonJS in new code.
- **Node 18+.** `package.json` declares `engines`; do not use APIs newer than that.
- **Tests use `node:test`** with `node:assert/strict`. Name tests `<AREA>-<n>: <what it guarantees>`, e.g. `LIC-3`, `COORD-2`, `DFR-5`.
- **Two kinds of suite, one glob.** `test/*.test.js` ships with the package and must pass for a consumer. Suites named `test/repo.*.test.js` freeze this repository's own assets and are deliberately **not published** (`test/repo.*.test.js` and `baseline-config.json` are absent from the `files` allowlist — DS-4 enforces that). Both kinds run in `npm test`, which is why the shared glob must stay valid in the tarball too: never point an npm script at a path the package does not ship.
- **Zero new dependencies.** Any capability you need must come from Node builtins (`node:fs`, `node:crypto`, `node:test`, `fetch`). `acorn`/`acorn-walk` are the only allowed exceptions and only for AST work.
- **Skills are a directory, not a script:** `skills/<name>/SKILL.md` (YAML frontmatter with `name` + `description`) plus a `README.md`, and templates under `template/`. The `description` field is the discovery surface that skill marketplaces and agents match against — keep it trigger-rich and factual.
- **Language:** English for code, comments, docs and commit subjects. No accents in commit subjects or filenames (Windows/CI safety).

## Non-negotiable rules

1. **Fail closed, never open.** A guard that cannot verify must fail loudly, not skip. Never weaken an assertion to make a suite pass — fix the cause. Do not add silent `try/catch` around checks.
2. **Never silence the design freeze.** `baseline-config.json` is not a place to make a red suite green: the banner, the social preview and the README copy are one identity, and the freeze compares the renders against each other, so restyling one of them alone fails. If a design change is genuinely wanted, add an `authorizedExceptions` entry with a task id, an authorizer, that person's actual words and a date — DFR-9 rejects rubber stamps, and an exception shorter than 40 characters is not a decision.
3. **Never edit the license pin to make it pass.** [`test/license-integrity.test.js`](test/license-integrity.test.js) compares `LICENSE` against the canonical PolyForm Noncommercial 1.0.0 text (git blob `5ecc88cfc4b1cff608ed640efe913c9dd97935c3`) plus exactly one `Required Notice:` line. If it fails, restore the text; do **not** re-pin the fixture to whatever is on disk, and do not change the declared license.
4. **No private data in tracked files.** No personal names, no absolute machine paths (drive letters followed by a separator, POSIX home directories, desktop or sync-folder locations), no tokens, no internal project names, no contact addresses. The published surface must be safe to read by strangers — `test/discovery-surface.test.js` (DS-8) enforces this on every discovered document.
5. **Diagnostics, not mysteries.** A failing guard must name the file, the line, the cause and the remedy. "Expected true, got false" is a bug in the guard.
6. **Deterministic output.** Anything generated must be reproducible byte-for-byte; never assert on timestamps, hashes of the working tree, or unordered filesystem iteration.

## Definition of done

Before you report a task as complete:

- `npm test` is green (all suites, including the license guard).
- `npm pack --dry-run` still ships `LICENSE` and does not ship secrets, editor config or state directories (`.agent-coord/`, `.git/`).
- New skills ship frontmatter, a `README.md` and templates; new behavior ships a test that fails without the change.
- The working tree contains only intended files — no debug leftovers, no generated tarballs.

## Security and licensing

The package is distributed under **PolyForm Noncommercial 1.0.0**: noncommercial use is free, commercial use requires a license from the maintainers. Do not add code, copy or dependencies that would conflict with that, and do not relicense any file. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md).
