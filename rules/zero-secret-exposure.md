# Universal Rule: Zero Secret Exposure & Credential Isolation

## Core Principle

Privileged credentials, API tokens (OpenAI, Gemini, Stripe, Supabase `service_role`, Resend, private PEM keys), and database connection strings with plaintext passwords must **never exist in source code, client-facing artifacts, or version control history**. Secrets must be injected exclusively through secure environment variables at runtime.

## Prohibited Behaviors

1. **Privileged Keys in Client Bundles**:
   - Never bundle service-role keys, backend webhook secrets, or administrative tokens into code distributed to browsers, mobile apps, or static CDNs.
   - Any client-exposed token must be strictly unprivileged and read-only / public by design (e.g. Supabase anonymous key with Row-Level Security, public publishable keys).

2. **Hardcoded Credentials in Repository Files**:
   - Never embed live credentials in `.js`, `.ts`, `.json`, `.yml`, or documentation files.
   - Never commit database connection strings containing live passwords (e.g. `postgres://user:secret@host/db`).
   - Never commit temporary credentials with the intent of "removing them before merging" — Git commits persist across branches and remotes.

3. **Insecure Test Fixtures**:
   - Tests must never use production secrets as fixture data.
   - Use mock servers, ephemeral test environments, or synthetic test tokens that carry zero production access.

## Enforcement Standard

1. **Environment Variable Injection**: All secrets must be loaded via `process.env` (or cloud platform secret bindings like Cloudflare Worker bindings / Netlify environment variables).
2. **Gitignore Sanitation**: All local environment files (`.env`, `.env.local`, `.env.production`) must be strictly ignored in `.gitignore`. Provide only `.env.example` with empty placeholder schemas.
3. **Fail-Closed Secret Auditing**: Continuous integration and deployment scripts must run static secret pattern detection before compiling and shipping production artifacts.
