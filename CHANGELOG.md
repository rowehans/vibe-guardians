# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **This repository now guards itself.** `test/repo.design-freeze.test.js` applies `design-freeze-guardian` to vibe-guardians: nine checks freeze the brand palette, the three brand gradients in role order, the critical copy across the banner, the social preview, the README and `llms.txt`, and the dimensions of the rendered PNGs. The README banner and the social preview are compared against **each other**, so they cannot drift into two identities.
- `baseline-config.json` — the frozen baseline, following the schema documented in the skill. It is repository-only and is never published.
- `skills/design-freeze-guardian/template/theme.sample.css` — a stand-in token file so the shipped template runs green out of the box before you point it at your own.
- `test/design-freeze-template.test.js` — scaffolds the shipped template into a real temporary project and proves it fails closed: missing baseline, unconfigured baseline, missing target, unauthorized drift, rubber-stamp exception and a CRLF checkout are all exercised for real.

### Fixed

- **The shipped design freeze template passed blindly.** It returned early (`if (!fs.existsSync(config)) return;`) whenever it could not read its baseline, its target file or `designTokens`, so it certified a freeze it had not verified — the exact failure mode this project exists to prevent, hidden inside the project. It is now fail-closed with file/line/cause/remedy diagnostics, validates authorization records properly, and no longer verifies nothing when the configuration is incomplete.
- **The template produced false failures on Windows.** Git may check the same file out as CRLF, so the hash of an unchanged token file differed from its baseline. Line endings are now normalised before hashing, and `test/design-freeze-template.test.js` (DFT-8) pins that behaviour so it cannot regress.
- **The sample baseline was internally impossible**: it pointed at `src/styles/theme.css` with the SHA-256 of the empty string, so it could never pass. It now ships a real sample and a real hash.
- `criticalCopy` was declared in the template's configuration but never read by any check; the template now validates its shape, and the repository's own suite shows the richer per-file pattern.

### Changed

- `npm test` now runs the repository-only suites as well: one shared `test/*.test.js` glob covers both, so the same command works in the repository and in an installed package.
- The `files` allowlist now names the published suites explicitly instead of shipping `test/` wholesale, so the frozen repository assets stay out of the tarball while every suite a consumer receives is still complete (DS-4 verifies both directions).

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

### Notes

- Licensed under **PolyForm Noncommercial 1.0.0**: free for noncommercial use, commercial use requires a license from the maintainers.
- Runtime dependencies: none. `acorn` and `acorn-walk` are used only by the AST analyzer.

[Unreleased]: https://github.com/rowehans/vibe-guardians/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rowehans/vibe-guardians/releases/tag/v1.0.0
