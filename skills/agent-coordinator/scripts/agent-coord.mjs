#!/usr/bin/env node

/**
 * agent-coord.mjs — Multi-Agent Collision Prevention & File-Lock Coordinator
 *
 * Prevents race conditions and file collisions when multiple AI assistants
 * (Cursor, Claude Code, Antigravity, Windsurf, Aider, Codex) work on the same repo.
 *
 * Zero external dependencies. Pure Node.js ESM.
 *
 * This file is only the command-line face: the rules live in coord-core.mjs so
 * that the MCP server (mcp-server.mjs) enforces exactly the same ones.
 */

import process from "node:process";
import { createCoordinator } from "./coord-core.mjs";

const coord = createCoordinator(process.cwd());

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function parseArgs(args) {
  const result = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    } else {
      result._.push(arg);
    }
  }
  return result;
}

function reportConflicts(conflicts) {
  console.error(`${RED}[GUARD REJECT] Scope collision detected!${RESET}`);
  for (const conf of conflicts) {
    console.error(`  - File '${conf.file}' is locked by Agent '${conf.agent}' on task '${conf.taskId}'`);
  }
}

function cmdStatus() {
  const board = coord.status();
  console.log(`${CYAN}[AGENT-COORD]${RESET} System UTC: ${board.utc}`);
  console.log(`Active tasks: ${board.activeTasks} | Completed: ${board.completedTasks} | Active Leases: ${board.claims.length}\n`);

  if (board.claims.length === 0) {
    console.log("No active claims in progress. Worktree scope is clear.");
    return;
  }
  console.log(`${YELLOW}ACTIVE CLAIMS IN PROGRESS:${RESET}`);
  for (const claim of board.claims) {
    const minutes = claim.minutesRemaining;
    const tag = minutes !== null && minutes > 0 ? `(valid: ${minutes}m remaining)` : `${RED}(expired)${RESET}`;
    console.log(`- ${GREEN}${claim.taskId}${RESET} [${claim.agent}] ${tag}`);
    console.log(`  Scope: ${claim.scope.join(", ")}`);
    if (claim.summary) console.log(`  Summary: ${claim.summary}`);
  }
}

function cmdGuard(opts) {
  const verdict = coord.guard({ agent: opts.agent || "UNKNOWN", scope: opts.scope, taskId: opts.id });
  if (verdict.scope.length === 0) {
    console.log(`${GREEN}[GUARD PASS]${RESET} Scope empty or unconstrained.`);
    return;
  }
  if (!verdict.ok) {
    reportConflicts(verdict.conflicts);
    process.exit(1);
  }
  console.log(`${GREEN}[GUARD PASS]${RESET} Scope is clear of active collisions.`);
}

function cmdClaim(opts) {
  if (!opts.id) {
    console.error("Error: --id is required for claim.");
    process.exit(1);
  }
  const agent = opts.agent || "AnonymousAgent";
  const result = coord.claim({
    id: opts.id,
    agent,
    scope: opts.scope,
    minutes: Number(opts.minutes || 60),
    title: opts.title,
    summary: opts.summary,
    create: Boolean(opts.create),
    priority: opts.priority || "P2",
  });
  if (!result.ok) {
    reportConflicts(result.conflicts);
    process.exit(1);
  }
  console.log(`${GREEN}[CLAIM SUCCESS]${RESET} Task '${opts.id}' claimed by '${agent}' for ${Number(opts.minutes || 60)}m.`);
}

function cmdFinish(opts) {
  if (!opts.id) {
    console.error("Error: --id is required.");
    process.exit(1);
  }
  coord.finish({ id: opts.id, agent: opts.agent, result: opts.result || "Finished" });
  console.log(`${GREEN}[FINISH]${RESET} Task '${opts.id}' marked as done and claim released.`);
}

function cmdRelease(opts) {
  if (!opts.id) {
    console.error("Error: --id is required.");
    process.exit(1);
  }
  coord.release({ id: opts.id });
  console.log(`${YELLOW}[RELEASE]${RESET} Claim on '${opts.id}' released.`);
}

function cmdAudit() {
  const report = coord.audit();
  for (const error of report.errors) console.error(error);
  if (!report.ok) {
    console.error(`${RED}[AUDIT FAILED]${RESET} ${report.errors.length} integrity issues found.`);
    process.exit(1);
  }
  console.log(`${GREEN}[AUDIT PASS]${RESET} ${report.count} tasks audited. Zero duplicates or malformed records.`);
}

function cmdBoard(opts) {
  const board = coord.board();
  if (opts.json) {
    console.log(JSON.stringify(board, null, 2));
    return;
  }
  const columns = new Map();
  for (const task of board.tasks) {
    const status = task.status || "unknown";
    if (!columns.has(status)) columns.set(status, []);
    columns.get(status).push(task);
  }
  if (columns.size === 0) {
    console.log("Board is empty. Create one with: claim --create --id TASK-001 --scope src/");
    return;
  }
  for (const [status, tasks] of columns) {
    console.log(`${CYAN}${status}${RESET} (${tasks.length})`);
    for (const task of tasks) {
      const lease = board.claims.find((claim) => claim.taskId === task.id);
      const holder = lease ? ` -> ${lease.agent}` : "";
      console.log(`  ${task.priority || "P2"}  ${task.id}  ${task.title || ""}${holder}`);
    }
    console.log("");
  }
}

function cmdHelp() {
  console.log(`
agent-coord — Multi-Agent Collision Prevention & File-Lock Coordinator

Commands:
  status     Show current board status, active leases and task counts
             node agent-coord.mjs status

  guard      Verify if declared file scope conflicts with another active AI lease
             node agent-coord.mjs guard --agent Cursor --scope src/app.js,test/app.test.js

  claim      Claim a task lease and lock its scope
             node agent-coord.mjs claim --id TASK-101 --agent ClaudeCode --scope src/app.js --minutes 60
             node agent-coord.mjs claim --create --id TASK-102 --title "New feature" --agent Antigravity --scope src/

  finish     Mark task as completed, archive evidence and release file lock
             node agent-coord.mjs finish --id TASK-101 --agent ClaudeCode --result "All tests pass"

  release    Release task lease without marking it completed
             node agent-coord.mjs release --id TASK-101 --agent ClaudeCode

  audit      Validate board integrity, duplicate IDs and malformed records
             node agent-coord.mjs audit

  board      Print the task board, grouped by status (--json for raw data)
             node agent-coord.mjs board --json

Same rules, other door: run this as an MCP server and an assistant can do all of
the above as tool calls instead of reading these instructions.
`);
}

const argv = process.argv.slice(2);
const command = argv[0];
const parsed = parseArgs(argv.slice(1));

switch (command) {
  case "status": cmdStatus(); break;
  case "guard": cmdGuard(parsed); break;
  case "claim": cmdClaim(parsed); break;
  case "finish": cmdFinish(parsed); break;
  case "release": cmdRelease(parsed); break;
  case "audit": cmdAudit(); break;
  case "board": cmdBoard(parsed); break;
  case "help":
  case "--help":
  case "-h":
  default:
    cmdHelp();
    break;
}
