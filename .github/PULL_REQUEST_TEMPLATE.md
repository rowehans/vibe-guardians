## What invariant does this protect?

<!-- One or two sentences. If it adds a check, name the failure mode it catches. -->

## What breaks without it?

<!-- The concrete mistake, incident or drift this prevents. -->

## How did you verify it?

<!-- Paste real output. `npm test` and `npm pack --dry-run` are the baseline. -->

```
$ npm test
```

## Does it fail when it should?

<!-- For a new check: show the case that must fail (a fixture, a sabotage, an expected-error assertion). A check nobody has seen fail has not been tested. -->

## Checklist

- [ ] `npm test` is green (all suites), on Node 18+
- [ ] Fail-closed: the change fails instead of skipping when it cannot verify
- [ ] No new runtime dependencies (Node builtins or `acorn`/`acorn-walk` only)
- [ ] No private data, personal contact details, internal project names or absolute machine paths
- [ ] `LICENSE` untouched, and the pinned PolyForm text still verifies
- [ ] New behavior ships a test named `<AREA>-<n>: <guarantee>`
- [ ] Docs updated when the surface changed (`README.md`, `AGENTS.md`, `llms.txt`, skill frontmatter)
- [ ] No generated artifacts or tarballs committed
