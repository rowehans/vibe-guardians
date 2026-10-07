# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Universal Anti-Slop Engineering Rule** (`rules/anti-slop.md`): strict prohibition against mock implementations, fake dummy returns, unverified stubs, parasitic npm packages, and generic AI design clichés.
- **Task intake and backlog creation** (`coord-core.mjs`, `agent-coord.mjs`): added `create` command to add tasks to the backlog in `available` state without immediately taking an active file lease. Pinned by COORD-12.
- **Dependency modeling and execution gating**: added support for `dependsOn` / `--depends` in `create` and `claim`. Tasks with unfinished dependencies enter a `waiting` state on the board, and attempts to claim them fail closed until prerequisite tasks are finished. Pinned by COORD-13.
- **Deep dependency audit**: extended `audit` to detect broken dependency references, self-dependencies, and cycles across the task dependency graph. Pinned by COORD-14.
- **Multi-agent & operational workflow rules** — added seven core engineering protocols in `rules/`:
  - `anti-slop.md`: zero mock implementations, zero parasitic dependencies, zero generic AI clichés.
  - `continuous-task-pipeline.md`: autonomous task intake, auto-chaining, and anti-idleness on shared workboards.
  - `dirty-worktree-isolation.md`: forbids compiling bundles or deploying over uncommitted in-flight changes.
  - `empirical-flow-verification.md`: mandates terminal command verification and empirical proof before claiming success.
  - `multi-agent-anti-deadlock.md`: anti-collision task selection, single-workspace serialization, and active lease grace periods.
  - `strict-modularity.md`: enforces deep modules, single source of truth, and separation of UI components from domain math.
  - `user-halt-protocol.md`: immediate freeze and graceful drain when a human operator halts the development run.
  - `zero-ignored-defects.md`: forbids silently bypassing bugs found in flight; mandates immediate surgical fix or formal workboard task.
- **Discovery surface indexing** — updated `llms.txt` and `README.md` to reference the expanded rule catalog and capabilities.

### Fixed

- **An expired lease blocked its scope forever.** Leases are time-boxed, but `scopeConflicts` never checked `isExpired`, so a forgotten lease kept colliding every `guard`/`claim` until manually deleted — the opposite of what a grace-period lease is for. Expired leases now stop blocking (and their scope is claimable again); `status` still lists them as `expired` so their history stays visible. Pinned by COORD-6.
- **Anyone could close or drop a lease they did not hold.** `finish` and `release` accepted any `--agent` value — or none — and stamped that name into `closedBy`, so an agent (or a typo, or a hallucinated identity) could attribute or abort another agent's in-flight work. Both verbs now refuse a missing `--agent` and refuse an agent that differs from the lease holder; the CLI help says so. This makes the documented protocol (SKILL.md already showed `--agent` on both) enforced rather than advisory. Pinned by COORD-8.
- **A corrupt board was silently replaced by an empty one.** `readTasks` swallowed JSON parse errors and returned `[]`, so the first write after any corruption would rewrite the whole board without its tasks — data loss dressed up as robustness, and the exact opposite of this project's fail-closed rule. A corrupt or non-array board now throws an integrity emergency naming the file, every command exits non-zero with the cause, and the file is left untouched for recovery. Pinned by COORD-9.
- **Scope collisions matched raw string prefixes.** `src/app.js` collided with `src/app.test.js`, and `src` collided with `srcx`. The comparison now respects path boundaries: a directory lease covers its descendants, a file lease covers that file, sibling names that merely share characters do not collide, and `./` prefixes plus Windows separators compare as the same path. Pinned by COORD-10.
- **A guard with no declared scope passed.** `guard --agent X` (no `--scope`) returned `[GUARD PASS]` for nothing — a rubber stamp, the failure mode this tool exists to prevent. An empty scope now fails with the remedy in the message instead of certifying an unchecked state. Pinned by COORD-7.
- **A stale lock wedged every agent.** The coordination lock had no recovery path: a process killed between open and unlink left `.agent-coord/.lock` behind and every subsequent write burned the full retry window, then died. Locks older than 3 seconds are now recognized as abandoned and recovered. Pinned by COORD-11.

### Changed

- **`finish` and `release` now require `--agent` and verify lease ownership** (see Fixed above); scripts calling these verbs without `--agent` must add it.
- **`guard` requires a non-empty `--scope`**: declaring what you intend to touch is the contract the check verifies.
- **The CLI reports refused operations as clean `[AGENT-COORD ERROR]` exits** with cause and remedy instead of a bare stack trace (integrity emergencies, ownership refusals).

- **The commercial reservation is stated, not implied.** The README legal section now says outright that the original author reserves all commercial rights, spells out what counts as commercial or enterprise use (paid product, paid extension or plugin, hosted service or SaaS, client deliverable, internal company workflows), and gives the concrete channel to request a separate commercial license — GitHub Issues, deliberately not an address, so the published-surface guard stays meaningful. The permitted/prohibited table is labelled as a plain-language reading aid that cannot vary the license, and the FAQ answer now says "separate commercial license" rather than "a license". [`LICENSE`](LICENSE) is untouched: it remains byte-identical to the canonical PolyForm Noncommercial 1.0.0 text plus its single `Required Notice:` line, which is what the license asks for.

## [1.0.0] - 2026-09-21

First public release.

### Added

- **`agent-coordinator`** — zero-dependency file-lock protocol and coordination board for concurrent AI agents, with task leases, shared-resource collision detection, a scope `guard`, and evidence-gated closure.
- **`design-freeze-guardian`** — test suite that freezes design tokens, palettes and critical UI copy against unprompted drift, with authorization records in `baseline-config.json`.
- **`ast-async-hygiene`** — AST analyzer that flags floating promises on database/network mutations and empty `catch` blocks; ships as a reusable test template.
- **Rules** — `rules/fail-closed-builds.md` and `rules/anti-overfitting.md`.
- **Agent discovery surface** — [`AGENTS.md`](AGENTS.md) and [`llms.txt`](llms.txt) so assistants and LLM tooling can find and apply the protocols without human translation, plus thin pointers for tools that still look for `CLAUDE.md` or Copilot instructions.
- **Project health files** — `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue and pull-request templates, and a CI workflow that runs every suite on Node 18, 20 and 22 and fails if `LICENSE` would not ship.
- **Fail-closed license guard** — `test/license-integrity.test.js` pins `LICENSE` to the canonical PolyForm Noncommercial 1.0.0 text (git blob `5ecc88cfc4b1cff608ed640efe913c9dd97935c3`) plus exactly one `Required Notice:` line, and keeps the SPDX declaration, README badge and README legal section coherent with the file.
- **The repository guards itself** — `test/repo.design-freeze.test.js` applies the design freeze to this project: nine checks pin the brand palette, the three brand gradients in role order, the critical copy across the banner, the social preview, the README and `llms.txt`, and the dimensions of the rendered PNGs, comparing the two renders against **each other** so they cannot drift into two identities.
- `baseline-config.json` — the frozen baseline, following the schema documented in the skill. Repository-only; never published.
- `skills/design-freeze-guardian/template/theme.sample.css` — a stand-in token file so the shipped template runs green out of the box before you point it at your own.
- `test/design-freeze-template.test.js` — scaffolds the shipped template into a real temporary project and proves it fails closed: missing baseline, unconfigured baseline, missing target, unauthorized drift, rubber-stamp exception and a CRLF checkout are all exercised for real.

### Fixed

- **The shipped design freeze template passed blindly.** It returned early (`if (!fs.existsSync(config)) return;`) whenever it could not read its baseline, its target file or `designTokens`, so it certified a freeze it had not verified — the exact failure mode this project exists to prevent, hidden inside the project. It is now fail-closed with file/cause/remedy diagnostics, validates authorization records properly, and no longer verifies nothing when the configuration is incomplete.
- **The template produced false failures on Windows.** Git may check the same file out as CRLF, so the hash of an unchanged token file differed from its baseline. Line endings are normalised before hashing, and `test/design-freeze-template.test.js` (DFT-8) pins that behaviour so it cannot regress.
- **The sample baseline was internally impossible**: it pointed at `src/styles/theme.css` with the SHA-256 of the empty string, so it could never pass. It now ships a real sample and a real hash.
- `criticalCopy` was declared in the template's configuration but never read by any check; the template now validates its shape, and the repository's own suite shows the richer per-file pattern.
- **Module system declared in the template's setup.** The template is an ES module: a project that does not declare `"type": "module"` (or keep the file as `.mjs`) cannot load it on Node 18, which does not detect module syntax.
- **The template test harness reads both runner reporters.** Node emits TAP when stdout is not a terminal (CI) and the spec reporter on a terminal; reading only one made a healthy child look silent.

### Changed

- The `files` allowlist now names the published suites explicitly instead of shipping `test/` wholesale, so the frozen repository assets stay out of the tarball while every suite a consumer receives is still complete (DS-4 verifies both directions).
- Suites that only make sense in this repository are named `test/repo.*.test.js`; one shared `test/*.test.js` glob keeps `npm test` identical in the repository and in an installed package.

### Notes

- Licensed under **PolyForm Noncommercial 1.0.0**: free for noncommercial use, commercial use requires a license from the maintainers.
- Runtime dependencies: none. `acorn` and `acorn-walk` are used only by the AST analyzer.

[Unreleased]: https://github.com/rowehans/vibe-guardians/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rowehans/vibe-guardians/releases/tag/v1.0.0
