# 🛡️ Vibe Guardians

> **Universal anti-regression guardians, design freeze test suites, and multi-agent coordination protocols for AI coding assistants (Cursor, Claude Code, Antigravity, Windsurf, Aider).**

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE)
[![Skills.sh Compatible](https://img.shields.io/badge/skills.sh-ready-success.svg)](https://skills.sh)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

---

## ⚡ Why Vibe Guardians?

AI coding assistants are transforming software engineering, but they introduce three universal points of friction:

1. **🎨 The Unwanted Redesign (Visual Drift):** The AI fixes a backend endpoint, but silently restyles your buttons, alters brand colors, or changes marketing copy without permission.
2. **💥 Multi-Agent Collisions:** Running multiple AI agents or subagents concurrently leads to overlapping edits, dirty git trees, and destroyed progress.
3. **🕳️ Silent Async Defects:** AIs frequently omit `await` before database mutations or wrap failing tests in empty `catch (e) {}` blocks, causing silent data loss in production.

**Vibe Guardians** provides battle-tested, zero-dependency tools to eliminate these risks.

---

## 📦 What's Inside?

### 1. `design-freeze-guardian` 🎨
A cryptographic test suite that hashes CSS tokens, Tailwind theme variables, and critical UI copy.
- **Fail-Closed:** If an AI alters styling or copy without an authorized quote in `baseline-config.json`, the test fails immediately.
- **Location:** `skills/design-freeze-guardian/`

### 2. `agent-coordinator` 🤝
A zero-dependency, local file-lock CLI that manages tasks, claims, and active file scopes for concurrent AI tools.
- **Atomic Locking:** Mutual exclusion using file descriptors.
- **UTC Leases:** Timeouts that prevent deadlocks if an agent process exits unexpectedly.
- **Location:** `skills/agent-coordinator/`

### 3. `ast-async-hygiene` 🧹
A lightweight static AST analyzer powered by Acorn that inspects code before deployment.
- **Floating Promise Detection:** Flags unawaited database calls and network requests.
- **Anti-Silent-Catch:** Rejects empty `catch` blocks that swallow exceptions.
- **Location:** `skills/ast-async-hygiene/`

---

## 🚀 Quickstart

### Option A: Install as an Agent Skill (via `skills.sh`)

Install individual guardians into your project or global AI config:

```bash
# Install the Design Freeze Guardian
npx skills add <your-username>/vibe-guardians -s design-freeze-guardian -g -y

# Install the Agent Coordinator
npx skills add <your-username>/vibe-guardians -s agent-coordinator -g -y

# Install AST Async Hygiene
npx skills add <your-username>/vibe-guardians -s ast-async-hygiene -g -y
```

### Option B: Run the Agent Coordinator CLI directly

```bash
# Check coordination board
node skills/agent-coordinator/scripts/agent-coord.mjs status

# Guard target scope before editing
node skills/agent-coordinator/scripts/agent-coord.mjs guard --agent Cursor --scope src/app.js

# Claim a task lease
node skills/agent-coordinator/scripts/agent-coord.mjs claim --create --id TASK-01 --agent Cursor --scope src/app.js --minutes 60

# Finish and release lock
node skills/agent-coordinator/scripts/agent-coord.mjs finish --id TASK-01 --agent Cursor --result "Feature complete"
```

---

## 🧪 Running the Test Suite

Vibe Guardians uses the native Node.js test runner:

```bash
npm install
npm test
```

---

## 📜 License & Terms of Use (Términos de Uso)

This project is licensed under the **PolyForm Noncommercial License 1.0.0** with commercial rights reserved by the author.

| Permitted / Permitido ✅ | Prohibited / Prohibido ❌ |
|---|---|
| **Personal Use:** Free for individual developers and hobby projects. | **Commercial Resale:** Selling, charging for, or reselling this tool. |
| **Education & Learning:** Free for students, researchers, and schools. | **Paid Bundling:** Packaging inside paid extensions, SaaS, or commercial software. |
| **Forking & Modifying:** Adapting the code for personal non-profit needs. | **Enterprise Profit:** Commercial entities using it for business advantage without a commercial license. |

### 💼 Commercial Licensing (Licenciamiento Comercial)

Are you a company, startup, or enterprise wanting to integrate Vibe Guardians into your commercial products, IDE extensions, or internal corporate workflows?

**Commercial licenses are available.** To obtain a commercial license, custom integration, or enterprise support, please open an inquiry on GitHub Issues or contact the project maintainers.

---

*Crafted by the Vibe Guardians Open Community.*
