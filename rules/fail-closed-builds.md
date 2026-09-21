# Universal Rule: Fail-Closed Builds & Deployment Integrity

## Core Principle

Build pipelines, compilation scripts, and bundle processors must always operate in **fail-closed mode**: if any error, warning, or unexpected condition occurs during bundling or transpilation, the process must immediately terminate with exit code `!= 0`.

## Prohibited Behaviors

1. **Silent Fallbacks to Raw Source**:
   - Never fall back to serving or publishing uncompiled JSX, unbundled modules, or unminified files if esbuild/vite/webpack fails.
2. **Ignored Exit Codes in Deployment Scripts**:
   - Build scripts must never swallow child process exit codes or emit success messages if an underlying compilation step threw an error.
3. **Optimistic Production Verification**:
   - Never declare a production deployment successful without running live health checks, content-hash verification, and CDN edge propagation probes.
