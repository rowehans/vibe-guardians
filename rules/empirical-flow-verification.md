# Universal Rule: Empirical Flow Verification ("Test What You Fix")

## Core Principle

An AI coding assistant must **never declare a bug resolved or a feature complete based solely on theoretical correctness, clean compilation, or isolated unit tests that do not replicate the end-to-end user lifecycle**. Every fix must be proven with empirical verification through the complete data flow.

## Prohibited Behaviors

1. **Aspirational Green Suites**:
   - Do NOT write unit tests that assert mock state without testing the real mutation lifecycle.
2. **Premature Completion on Build Success**:
   - Compiling without errors or passing lint/syntax checks does NOT mean a functional bug is fixed.
3. **Disconnected Unit Testing**:
   - If a bug involves data persistence (e.g. form inputs disappearing after refresh), testing only the form component in memory without testing storage serialization, normalization filters, and deserialization is unacceptable.

## Mandatory Verification Flow

For any interactive, stateful, or data-driven fix:
1. **Event Triggering**: Programmatically trigger user events (`input`, `change`, `click`, API requests).
2. **State Mutation**: Verify the reactive or in-memory state reflects the updated value.
3. **Persistence Roundtrip**: Execute the underlying storage save/upsert call.
4. **Normalization & Deserialization**: Run through the normalization pipeline (`normalizeSettings`, schema parsers) to guarantee intermediate sanitizers do not drop fields.
5. **Render Parity**: Verify the restored state renders accurately in the consumer UI or output.
