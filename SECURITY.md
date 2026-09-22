# Security Policy

## Supported versions

The latest published release on `main` is supported. This project has no runtime service, no network listener and no credentials of its own — it is a set of local test suites and a local file-lock CLI.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Use GitHub's private reporting:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability** (GitHub Security Advisories).
3. Describe the impact, the smallest reproduction, and the affected version or commit.

You can expect an acknowledgement within a few days. Please give us a chance to ship a fix before any public disclosure.

## What is in scope

- A guard that can be made to **pass while the invariant it claims to enforce is violated** (a false negative is the worst bug this project can have).
- A check that silently **skips** instead of failing when it cannot verify its subject.
- Data leakage in the published package: private identifiers, absolute machine paths, tokens or credentials in the tarball.
- Path traversal, symlink or race-condition issues in `agent-coordinator`'s locking and state files.
- Supply-chain concerns: any new dependency, install script or postinstall hook.

## What is out of scope

- Issues in the projects that use these templates (report those upstream).
- "The guard failed and I did not want it to" — that is the guard working as designed; the remedy is to satisfy it or edit the baseline through an explicit, recorded authorization.
- Anything requiring an already-compromised machine or repository write access.

## Design commitments you can rely on

- **Fail closed.** An unverifiable check fails the run.
- **No silent skips** in the guard suites.
- **No install-time code.** The package declares no `preinstall`/`postinstall` hooks.
- **Deterministic output.** Generated artifacts are reproducible byte-for-byte.
