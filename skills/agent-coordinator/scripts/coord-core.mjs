/**
 * coord-core.mjs — the coordination logic, with no opinion about how it is called.
 *
 * The CLI (`agent-coord.mjs`) prints and exits; the MCP server
 * (`mcp-server.mjs`) speaks JSON-RPC to an assistant. Both must enforce
 * *identical* rules — a lock an agent can take through one door and not see
 * through the other is worse than no lock — so the rules live here once and the
 * two front-ends only translate.
 *
 * Zero dependencies. ESM. Node 18+.
 *
 * Every function returns structured data and never writes to stdout or calls
 * process.exit: a library that kills its caller cannot be embedded in a server.
 */

import fs from "node:fs";
import path from "node:path";

const CLAIMS_DIR = "claims";
const HISTORY_DIR = "history";
const QUEUE_DIR = "queue";
const LOCK_FILE = ".lock";
const DEFAULT_LEASE_MINUTES = 60;
const LOCK_ATTEMPTS = 60;
const LOCK_RETRY_MS = 50;

const normalizeScope = (scope) =>
  String(scope ?? "")
    .split(",")
    .map((entry) => entry.trim().replace(/\\/g, "/"))
    .filter(Boolean);

export function createCoordinator(root) {
  const base = path.resolve(root ?? process.cwd());
  const coord = path.join(base, ".agent-coord");
  const claimsDir = path.join(coord, CLAIMS_DIR);
  const historyDir = path.join(coord, HISTORY_DIR);
  const queueDir = path.join(coord, QUEUE_DIR);
  const lockFile = path.join(coord, LOCK_FILE);
  // A repository may keep its board in version control; otherwise it is local state.
  const tasksFile = fs.existsSync(path.join(base, "docs", "agent-tasks.json"))
    ? path.join(base, "docs", "agent-tasks.json")
    : path.join(coord, "tasks.json");

  const sleep = (ms) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      // Busy-wait, kept deliberately: the lock is held for microseconds and a
      // timer would let Node exit mid-critical-section.
    }
  };

  function ensureDirs() {
    fs.mkdirSync(claimsDir, { recursive: true });
    fs.mkdirSync(historyDir, { recursive: true });
    fs.mkdirSync(queueDir, { recursive: true });
    if (!fs.existsSync(tasksFile)) fs.writeFileSync(tasksFile, "[]\n", "utf8");
  }

  function withLock(fn) {
    ensureDirs();
    let fd;
    for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
      try {
        fd = fs.openSync(lockFile, "wx");
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
        break;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        sleep(LOCK_RETRY_MS);
      }
    }
    if (fd === undefined) {
      throw new Error("Could not acquire coordination lock within 3 seconds.");
    }
    try {
      return fn();
    } finally {
      try {
        fs.closeSync(fd);
      } catch {}
      try {
        fs.unlinkSync(lockFile);
      } catch {}
    }
  }

  function readTasks() {
    ensureDirs();
    try {
      const parsed = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeJsonAtomic(file, value) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, file);
  }

  function activeClaims() {
    ensureDirs();
    const now = Date.now();
    const claims = [];
    for (const file of fs.readdirSync(claimsDir).filter((name) => name.endsWith(".json"))) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(claimsDir, file), "utf8"));
        const expiresAt = Date.parse(data.expiresAt || "");
        data.isExpired = Number.isNaN(expiresAt) ? false : now >= expiresAt;
        claims.push(data);
      } catch {
        // A corrupt claim cannot be interpreted; ignore it rather than crashing
        // the board (audit reports the integrity of the task list, not claims).
      }
    }
    return claims;
  }

  /** Collisions between a requested scope and the leases others hold. */
  function scopeConflicts(scope, { agent, taskId } = {}) {
    const wanted = normalizeScope(scope);
    if (wanted.length === 0) return [];
    const conflicts = [];
    for (const claim of activeClaims()) {
      const holder = claim.taskId ?? claim.id;
      if (agent && claim.agent === agent && holder === taskId) continue;
      const held = (Array.isArray(claim.scope) ? claim.scope : [claim.scope]).map((entry) => String(entry).replace(/\\/g, "/"));
      for (const file of wanted) {
        for (const claimed of held) {
          if (file.startsWith(claimed) || claimed.startsWith(file)) {
            conflicts.push({ file, agent: claim.agent, taskId: holder, scope: held });
          }
        }
      }
    }
    return conflicts;
  }

  return {
    root: base,
    coordDir: coord,
    tasksFile,

    status() {
      ensureDirs();
      const tasks = readTasks();
      const claims = activeClaims();
      return {
        utc: new Date().toISOString(),
        activeTasks: tasks.filter((task) => task.status !== "done").length,
        completedTasks: tasks.filter((task) => task.status === "done").length,
        claims: claims.map((claim) => ({
          taskId: claim.taskId ?? claim.id,
          agent: claim.agent,
          scope: Array.isArray(claim.scope) ? claim.scope : [claim.scope],
          summary: claim.summary ?? "",
          expiresAt: claim.expiresAt,
          expired: claim.isExpired === true,
          minutesRemaining: claim.expiresAt ? Math.round((Date.parse(claim.expiresAt) - Date.now()) / 60000) : null,
        })),
      };
    },

    guard({ agent, scope, taskId }) {
      const conflicts = scopeConflicts(scope, { agent, taskId });
      return { ok: conflicts.length === 0, scope: normalizeScope(scope), conflicts };
    },

    /** Take a lease. Returns {ok:false, conflicts} instead of throwing on collision. */
    claim({ id, agent = "AnonymousAgent", scope, minutes = DEFAULT_LEASE_MINUTES, title, summary = "", create = false, priority = "P2" }) {
      if (!id) throw new Error("--id is required for claim.");
      const conflicts = scopeConflicts(scope, { agent, taskId: id });
      if (conflicts.length > 0) return { ok: false, conflicts, id };

      const leaseMinutes = Number(minutes) || DEFAULT_LEASE_MINUTES;
      return withLock(() => {
        const claimData = {
          taskId: id,
          agent,
          // The CLI accepts a comma-separated string anywhere a scope is used.
          scope: String(scope ?? "")
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
          title: title || id,
          summary,
          claimedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + leaseMinutes * 60000).toISOString(),
        };
        writeJsonAtomic(path.join(claimsDir, `${id}.json`), claimData);

        const tasks = readTasks();
        const existing = tasks.find((task) => task.id === id);
        if (existing) {
          existing.status = "in_progress";
          existing.assignedTo = agent;
          existing.updatedAt = new Date().toISOString();
        } else if (create) {
          tasks.push({
            id,
            priority,
            title: title || id,
            scope: claimData.scope,
            status: "in_progress",
            createdBy: agent,
            createdAt: new Date().toISOString(),
          });
        }
        writeJsonAtomic(tasksFile, tasks);
        return { ok: true, id, agent, claim: claimData, created: Boolean(create) && !existing };
      });
    },

    /** Close a task, archiving the claim as history and releasing its scope. */
    finish({ id, agent, result, reason }) {
      if (!id) throw new Error("--id is required.");
      if (!String(result ?? "").trim()) throw new Error("--result is required and must summarize what was done.");
      if (!String(reason ?? "").trim()) throw new Error("--reason is required and must explain why the work was done.");
      return withLock(() => {
        const claimFile = path.join(claimsDir, `${id}.json`);
        const archived = fs.existsSync(claimFile);
        if (archived) {
          const claim = JSON.parse(fs.readFileSync(claimFile, "utf8"));
          writeJsonAtomic(path.join(historyDir, `${id}-${Date.now()}.json`), {
            ...claim,
            finishedAt: new Date().toISOString(),
            result,
            reason,
          });
          fs.unlinkSync(claimFile);
        }
        const tasks = readTasks();
        const task = tasks.find((item) => item.id === id);
        if (task) {
          task.status = "done";
          task.closedAt = new Date().toISOString();
          task.result = result;
          task.reason = reason;
          if (agent) task.closedBy = agent;
          writeJsonAtomic(tasksFile, tasks);
        }
        return { ok: true, id, archived, closed: Boolean(task), result, reason };
      });
    },

    /** Append an independent review record without overwriting the task's author or closure evidence. */
    review({ id, reviewer, summary, reason }) {
      if (!id) throw new Error("--id is required.");
      if (!String(reviewer ?? "").trim()) throw new Error("--reviewer is required.");
      if (!String(summary ?? "").trim()) throw new Error("--summary is required and must state what was reviewed.");
      if (!String(reason ?? "").trim()) throw new Error("--reason is required and must explain the review outcome.");
      return withLock(() => {
        const tasks = readTasks();
        const task = tasks.find((item) => item.id === id);
        if (!task || task.status !== "done") throw new Error(`Task '${id}' must exist and be done before it can be reviewed.`);
        const review = { reviewedBy: reviewer, reviewedAt: new Date().toISOString(), summary, reason };
        task.reviews = Array.isArray(task.reviews) ? [...task.reviews, review] : [review];
        writeJsonAtomic(tasksFile, tasks);
        return { ok: true, id, review };
      });
    },

    /** Drop a lease without completing the task. */
    release({ id }) {
      if (!id) throw new Error("--id is required.");
      return withLock(() => {
        const claimFile = path.join(claimsDir, `${id}.json`);
        const released = fs.existsSync(claimFile);
        if (released) fs.unlinkSync(claimFile);
        const tasks = readTasks();
        const task = tasks.find((item) => item.id === id);
        if (task && task.status === "in_progress") {
          task.status = "available";
          delete task.assignedTo;
          writeJsonAtomic(tasksFile, tasks);
        }
        return { ok: true, id, released };
      });
    },

    audit() {
      ensureDirs();
      const tasks = readTasks();
      const seen = new Set();
      const errors = [];
      for (const task of tasks) {
        if (!task.id) errors.push("Task without ID found!");
        else if (seen.has(task.id)) errors.push(`Duplicate task ID found: '${task.id}'`);
        else seen.add(task.id);
      }
      return { ok: errors.length === 0, count: tasks.length, errors };
    },

    /** The board as data, for a caller that wants to render it itself. */
    board() {
      const tasks = readTasks();
      const claims = activeClaims();
      return { tasks, claims: claims.map(({ isExpired, ...claim }) => ({ ...claim, expired: isExpired === true })) };
    },
  };
}
