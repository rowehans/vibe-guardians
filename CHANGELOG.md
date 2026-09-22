# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
