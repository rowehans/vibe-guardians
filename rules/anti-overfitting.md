# Universal Rule: Anti-Overfitting & Generic Algorithmic Invariants

## Core Principle

When an AI coding assistant fixes a bug or implements a feature, it must **never solve the problem by hardcoding specific literal values, special-case customer names, domain-specific strings, or test fixture IDs into core algorithmic modules**.

## Prohibited Behaviors

1. **Hardcoded Domain Dictionaries**:
   - Do NOT add lists of specific character names, customer names, or tenant IDs into generic parsers, calculators, or OCR utils.
2. **One-Off If/Else Patches**:
   - If a bug occurs for input `"user_123"` or a specific edge case string `"discount_march"`, do NOT write `if (input === 'user_123') return fallback`. The fix must be mathematically and architecturally symmetric for ALL possible inputs.
3. **Magic Constant Fitting**:
   - Do NOT tweak thresholds to fit only the current unit test suite if it reduces the algorithm's generalizability on unseen data.

## Correct Approach

- Use generic statistical distributions, universal frequency vocabularies, or general algorithmic workflows (e.g. Viterbi, Levenshtein, NMS).
- Ensure multi-tenant, multi-user, and multi-entity logic operates with 100% architectural symmetry.
