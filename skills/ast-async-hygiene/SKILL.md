---
name: ast-async-hygiene
description: Catch AI-generated async defects before they ship. Static AST analysis flags floating promises on database and network mutations (a missing await) and empty catch blocks that swallow exceptions, so silent data loss fails the build. Use when generating or reviewing JavaScript/TypeScript that writes to storage or calls an API.
---

# AST Async Hygiene Protocol

Use this skill to audit JavaScript and TypeScript files against common AI-generated async defects and silent error swallowing.

## Mandatory Invariants

1. **Zero Unawaited Mutations**:
   - Every call to database writes, encryption routines, and network mutations (`fetch`, `save`, `update`, `insert`) must be explicitly `await`ed or returned.
   - In serverless functions (AWS Lambda, Cloudflare Workers), unawaited calls cause silent data loss when the runtime execution context freezes.

2. **Zero Empty Catch Blocks**:
   - Never write `catch (e) {}` or `catch {}` without logging, alerting, or re-throwing. Swallowed exceptions turn transient network errors into impossible-to-reproduce bugs.

3. **Verification**:
   - Run the hygiene AST analyzer before completing tasks:
     ```bash
     node --test test/code-hygiene.test.js
     ```
