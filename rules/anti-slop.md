# Universal Rule: Anti-Slop Engineering & Zero Mock Implementations

## Core Principle

AI assistants naturally gravitate toward path-of-least-resistance solutions: fictitious placeholders, unnecessary third-party dependencies for trivial tasks, and generic aesthetic clichés. **Engineering discipline requires authentic implementations, zero parasitic dependencies, and purpose-driven design.**

## Prohibited Behaviors

1. **Fictitious Stubs and Fake Success**:
   - Never implement functions with hardcoded dummy returns (`return true;`, `return { status: 200 };`) or empty bodies disguised as completed features.
   - Never leave `// TODO: implement later` or placeholder comments when tasked with a feature or bugfix.
   - If a code branch is genuinely deferred, it must fail explicitly (`throw new Error("Not implemented: ...")`), never silently pretend to succeed.

2. **Parasitic Dependencies**:
   - Never introduce third-party npm packages for operations that modern ECMAScript or the Node.js standard library natively provide (e.g. `crypto.randomUUID()`, native `fetch`, `node:fs`, `node:path`, simple string formatting).
   - Every external dependency added to `package.json` must solve genuine domain complexity and be explicitly justified.

3. **Generic AI Design Clichés**:
   - Never inject AI-stereotyped visual trends that harm usability: neon purple/cyan glowing borders, excessive frosted glassmorphism that destroys WCAG contrast, unprompted micro-animations that drop frames.
   - Respect existing design tokens, typography scales, and brand constraints.

## Enforcement Standard

1. **Empirical Verification**: Every newly implemented capability must be backed by an automated test proving that it executes real business logic rather than dummy stubs.
2. **Minimal Footprint**: Verify whether a native standard-library approach solves the problem cleanly before reaching for package registries.
3. **Visual Integrity**: UI alterations must preserve readability, mobile ergonomics, and baseline design contracts.
