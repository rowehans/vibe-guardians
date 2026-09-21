#!/usr/bin/env node

/**
 * agent-coord.mjs — Multi-Agent Collision Prevention & File-Lock Coordinator
 * 
 * Prevents race conditions and file collisions when multiple AI assistants
 * (Cursor, Claude Code, Antigravity, Windsurf, Aider) work on the same repo.
 * 
 * Zero external dependencies. Pure Node.js ESM.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(process.cwd());
const COORD = path.join(ROOT, ".agent-coord");
const CLAIMS = path.join(COORD, "claims");
const HISTORY = path.join(COORD, "history");
const QUEUE = path.join(COORD, "queue");
const LOCK = path.join(COORD, ".lock");
const DEFAULT_TASKS_FILE = path.join(COORD, "tasks.json");

// Allow repo to define tasks in docs/agent-tasks.json if present
const TASKS = fs.existsSync(path.join(ROOT, "docs", "agent-tasks.json"))
  ? path.join(ROOT, "docs", "agent-tasks.json")
  : DEFAULT_TASKS_FILE;

function ensureDirs() {
  fs.mkdirSync(CLAIMS, { recursive: true });
  fs.mkdirSync(HISTORY, { recursive: true });
  fs.mkdirSync(QUEUE, { recursive: true });
  if (!fs.existsSync(TASKS)) {
    fs.writeFileSync(TASKS, "[]\n", "utf8");
  }
}

function sleep(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {}
}

function withLock(fn) {
  ensureDirs();
  let fd;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      fd = fs.openSync(LOCK, "wx");
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      sleep(50);
    }
  }
  if (fd === undefined) {
    throw new Error("Could not acquire coordination lock within 3 seconds.");
  }
  try {
    return fn();
  } finally {
    try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(LOCK); } catch {}
  }
}

function readTasks() {
  ensureDirs();
  try {
    return JSON.parse(fs.readFileSync(TASKS, "utf8"));
  } catch {
    return [];
  }
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

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

function getActiveClaims() {
  ensureDirs();
  const files = fs.readdirSync(CLAIMS).filter(f => f.endsWith(".json"));
  const claims = [];
  const now = Date.now();
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CLAIMS, f), "utf8"));
      const expiresAt = Date.parse(data.expiresAt || "");
      data.isExpired = isNaN(expiresAt) ? false : now >= expiresAt;
      claims.push(data);
    } catch {}
  }
  return claims;
}

// Commands
function cmdStatus() {
  ensureDirs();
  const claims = getActiveClaims();
  const tasks = readTasks();
  const activeCount = tasks.filter(t => t.status !== "done").length;
  const doneCount = tasks.filter(t => t.status === "done").length;

  console.log(`\x1b[36m[AGENT-COORD]\x1b[0m System UTC: ${new Date().toISOString()}`);
  console.log(`Active tasks: ${activeCount} | Completed: ${doneCount} | Active Leases: ${claims.length}\n`);

  if (claims.length === 0) {
    console.log("No active claims in progress. Worktree scope is clear.");
  } else {
    console.log("\x1b[33mACTIVE CLAIMS IN PROGRESS:\x1b[0m");
    for (const c of claims) {
      const expDate = new Date(c.expiresAt);
      const diffMin = Math.round((expDate.getTime() - Date.now()) / 60000);
      const tag = diffMin > 0 ? `(valid: ${diffMin}m remaining)` : `\x1b[31m(expired)\x1b[0m`;
      console.log(`- \x1b[32m${c.taskId || c.id}\x1b[0m [${c.agent}] ${tag}`);
      console.log(`  Scope: ${Array.isArray(c.scope) ? c.scope.join(", ") : c.scope}`);
      if (c.summary) console.log(`  Summary: ${c.summary}`);
    }
  }
}

function cmdGuard(opts) {
  const scope = (opts.scope || "").split(",").map(s => s.trim().replace(/\\/g, "/")).filter(Boolean);
  if (scope.length === 0) {
    console.log("\x1b[32m[GUARD PASS]\x1b[0m Scope empty or unconstrained.");
    return;
  }
  const claims = getActiveClaims();
  const caller = opts.agent || "UNKNOWN";
  const conflicts = [];

  for (const c of claims) {
    if (c.agent === caller && (c.taskId === opts.id || c.id === opts.id)) continue;
    const cScope = (Array.isArray(c.scope) ? c.scope : [c.scope]).map(s => String(s).replace(/\\/g, "/"));
    for (const file of scope) {
      for (const claimed of cScope) {
        if (file.startsWith(claimed) || claimed.startsWith(file)) {
          conflicts.push({ file, agent: c.agent, taskId: c.taskId || c.id });
        }
      }
    }
  }

  if (conflicts.length > 0) {
    console.error("\x1b[31m[GUARD REJECT] Scope collision detected!\x1b[0m");
    for (const conf of conflicts) {
      console.error(`  - File '${conf.file}' is locked by Agent '${conf.agent}' on task '${conf.taskId}'`);
    }
    process.exit(1);
  } else {
    console.log("\x1b[32m[GUARD PASS]\x1b[0m Scope is clear of active collisions.");
  }
}

function cmdClaim(opts) {
  if (!opts.id) {
    console.error("Error: --id is required for claim.");
    process.exit(1);
  }
  const agent = opts.agent || "AnonymousAgent";
  const scope = (opts.scope || "").split(",").map(s => s.trim()).filter(Boolean);
  const minutes = Number(opts.minutes || 60);
  const expiresAt = new Date(Date.now() + minutes * 60000).toISOString();

  withLock(() => {
    // Check conflicts
    cmdGuard({ scope: opts.scope, agent, id: opts.id });

    const claimData = {
      taskId: opts.id,
      agent,
      scope,
      title: opts.title || opts.id,
      summary: opts.summary || "",
      claimedAt: new Date().toISOString(),
      expiresAt
    };

    const claimFile = path.join(CLAIMS, `${opts.id}.json`);
    writeJsonAtomic(claimFile, claimData);

    // Update tasks board if exists
    const tasks = readTasks();
    const existing = tasks.find(t => t.id === opts.id);
    if (existing) {
      existing.status = "in_progress";
      existing.assignedTo = agent;
      existing.updatedAt = new Date().toISOString();
    } else if (opts.create) {
      tasks.push({
        id: opts.id,
        priority: opts.priority || "P2",
        title: opts.title || opts.id,
        scope,
        status: "in_progress",
        createdBy: agent,
        createdAt: new Date().toISOString()
      });
    }
    writeJsonAtomic(TASKS, tasks);
    console.log(`\x1b[32m[CLAIM SUCCESS]\x1b[0m Task '${opts.id}' claimed by '${agent}' for ${minutes}m.`);
  });
}

function cmdFinish(opts) {
  if (!opts.id) {
    console.error("Error: --id is required.");
    process.exit(1);
  }
  withLock(() => {
    const claimFile = path.join(CLAIMS, `${opts.id}.json`);
    if (fs.existsSync(claimFile)) {
      const claim = JSON.parse(fs.readFileSync(claimFile, "utf8"));
      const histFile = path.join(HISTORY, `${opts.id}-${Date.now()}.json`);
      writeJsonAtomic(histFile, { ...claim, finishedAt: new Date().toISOString(), result: opts.result || "Finished" });
      fs.unlinkSync(claimFile);
    }
    const tasks = readTasks();
    const t = tasks.find(item => item.id === opts.id);
    if (t) {
      t.status = "done";
      t.closedAt = new Date().toISOString();
      writeJsonAtomic(TASKS, tasks);
    }
    console.log(`\x1b[32m[FINISH]\x1b[0m Task '${opts.id}' marked as done and claim released.`);
  });
}

function cmdRelease(opts) {
  if (!opts.id) {
    console.error("Error: --id is required.");
    process.exit(1);
  }
  withLock(() => {
    const claimFile = path.join(CLAIMS, `${opts.id}.json`);
    if (fs.existsSync(claimFile)) {
      fs.unlinkSync(claimFile);
    }
    const tasks = readTasks();
    const t = tasks.find(item => item.id === opts.id);
    if (t && t.status === "in_progress") {
      t.status = "available";
      delete t.assignedTo;
      writeJsonAtomic(TASKS, tasks);
    }
    console.log(`\x1b[33m[RELEASE]\x1b[0m Claim on '${opts.id}' released.`);
  });
}

function cmdAudit() {
  ensureDirs();
  const tasks = readTasks();
  const ids = new Set();
  let errors = 0;

  for (const t of tasks) {
    if (!t.id) {
      console.error("Task without ID found!");
      errors++;
    } else if (ids.has(t.id)) {
      console.error(`Duplicate task ID found: '${t.id}'`);
      errors++;
    } else {
      ids.add(t.id);
    }
  }

  if (errors > 0) {
    console.error(`\x1b[31m[AUDIT FAILED]\x1b[0m ${errors} integrity issues found.`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m[AUDIT PASS]\x1b[0m ${tasks.length} tasks audited. Zero duplicates or malformed records.`);
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
`);
}

// Main Dispatcher
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
  case "help":
  case "--help":
  case "-h":
  default:
    cmdHelp();
    break;
}
