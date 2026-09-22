# Contributing to Vibe Guardians

Thanks for wanting to make AI assistants safer to point at a real codebase. This project is small, opinionated and deliberately boring to maintain.

## Ground rules

1. **Everything is fail-closed.** A guard that cannot verify its subject must fail, loudly, with a useful message. Never weaken an assertion to get a green run — fix the cause.
2. **Zero new runtime dependencies.** Use Node builtins. `acorn`/`acorn-walk` are allowed for AST work and nothing else.
3. **No private data in tracked files.** No personal names, contact addresses, tokens, customer identifiers, internal project names, or absolute machine paths (drive letters with a separator, POSIX home directories, desktop or sync folders). Anything you commit is public forever, and `test/discovery-surface.test.js` fails the build if one slips in.
4. **English** for code, comments, docs and commit subjects; no accents in commit subjects or filenames.
5. **Do not touch the license.** `LICENSE` is pinned to the canonical PolyForm Noncommercial 1.0.0 text by `test/license-integrity.test.js`. Contributions are accepted under that same license.

## Before you open a pull request

```bash
npm install
npm test        # must be green, every suite
npm pack --dry-run
```

Your PR should explain **what invariant it protects** and **what breaks without it**. A change that adds a check but no way to see it fail has not been tested — show the failing case (a fixture, a sabotage, an expected-error assertion).

## Adding a skill

A skill is a directory under `skills/`:

```
skills/<your-skill>/
  SKILL.md        # YAML frontmatter: name + description, then the protocol
  README.md       # what it does, when to use it, how to install it
  template/       # the executable test or config it ships
```

The `description` in the frontmatter is the **discovery surface**: agents and skill marketplaces match against it. Describe the failure mode you prevent, concretely, in one sentence — not "helps with quality".

Tests live in `test/` and use the native runner with `<AREA>-<n>: <guarantee>` names, e.g. `HYGIENE-2`, `COORD-3`. New behavior needs a test that fails without your change.

## Reporting bugs and proposing features

Use the issue templates. For a bug, include the Node version, the exact command, what you expected, and what happened (paste the real output — the guards are designed to produce actionable messages).

Security issues do **not** go in public issues: see [`SECURITY.md`](SECURITY.md).

## Commit style

Short imperative subjects in English (`test: reject empty catch blocks`), with a body that explains why the change is needed. Keep unrelated changes in separate commits.

By contributing you agree your contribution is distributed under the project's license (PolyForm Noncommercial 1.0.0).
