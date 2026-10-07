/**
 * coord-core.mjs — the coordination logic, with no opinion about how it is called.
 *
 * The CLI (`agent-coord.mjs`) prints and exits. The rules live here so that any
 * other front-end (an MCP server, a test harness, a script) enforces exactly the
 * same ones — a lock an agent can take through one door and not see through
 * another is worse than no lock.
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
const STALE_LOCK_MS = 3000;

const normalizeScope = (scope) =>
  String(scope ?? "")
    .split(",")
    .map((entry) => entry.trim().replace(/\\/g, "/"))
    .filter(Boolean);

const normalizeDependencies = (deps) => {
  if (Array.isArray(deps)) {
    return Array.from(new Set(deps.map((d) => String(d).trim()).filter(Boolean)));
  }
  return Array.from(
    new Set(
      String(deps ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
};

/**
 * Canonical form of one scope entry for comparison: forward slashes, no
 * trailing slash, no leading "./", "." (and an empty entry) meaning the repo
 * root itself.
 */
function normalizeEntry(entry) {
  let normalized = String(entry ?? "").trim().replace(/\\/g, "/");
  while (normalized.startsWith("./")) normalized = normalized.slice(2);
  normalized = normalized.replace(/\/+$/, "");
  return normalized === "." ? "" : normalized;
}

/**
 * True when two scope entries address an overlapping region of the tree.
 * A directory lease covers everything below it; a file lease covers exactly
 * that file. Sibling paths that merely share a string prefix ("src/app.js" vs
 * "src/app.test.js", "src" vs "srcx") do NOT overlap — the comparison is on
 * path boundaries, not raw prefixes.
 */
function scopeEntriesOverlap(a, b) {
  const x = normalizeEntry(a);
  const y = normalizeEntry(b);
  if (x === "" || y === "") return true; // one side is the repo root: it matches everything
  return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`);
}

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
        // A lock older than STALE_LOCK_MS belongs to a dead process: recover it
        // instead of making every agent wait out the whole retry window.
        let stale = false;
        try {
          stale = Date.now() - fs.statSync(lockFile).mtimeMs > STALE_LOCK_MS;
        } catch {
          stale = false; // vanished between EEXIST and stat: just retry normally
        }
        if (stale) {
          try {
            fs.unlinkSync(lockFile);
          } catch {}
          continue;
        }
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
    let raw;
    try {
      raw = fs.readFileSync(tasksFile, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return []; // no board yet: empty is a valid state
      throw error;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      // FAIL-CLOSED: a corrupt board is an integrity emergency. Falling back to
      // [] here would let the next write replace the whole board with an empty
      // file, silently destroying every task on it.
      throw new Error(
        `Coordination board '${tasksFile}' is not valid JSON (${error.message}). ` +
          "Fix or restore the file before running coordination commands; refusing to fall back to an empty board."
      );
    }
    if (!Array.isArray(parsed)) {
      throw new Error(
        `Coordination board '${tasksFile}' must contain a JSON array (got ${parsed === null ? "null" : typeof parsed}). ` +
          "Refusing to fall back to an empty board."
      );
    }
    return parsed;
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

  /** Read one claim file, or null when it does not exist. */
  function readClaim(claimFile) {
    if (!fs.existsSync(claimFile)) return null;
    return JSON.parse(fs.readFileSync(claimFile, "utf8"));
  }

  /** Collisions between a requested scope and the leases others hold. */
  function scopeConflicts(scope, { agent, taskId } = {}) {
    const wanted = normalizeScope(scope);
    if (wanted.length === 0) return [];
    const conflicts = [];
    for (const claim of activeClaims()) {
      if (claim.isExpired) continue; // an expired lease blocks nobody
      const holder = claim.taskId ?? claim.id;
      if (agent && claim.agent === agent && holder === taskId) continue;
      const held = (Array.isArray(claim.scope) ? claim.scope : [claim.scope]).map((entry) =>
        String(entry).replace(/\\/g, "/")
      );
      for (const file of wanted) {
        for (const claimed of held) {
          if (scopeEntriesOverlap(file, claimed)) {
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
      const wanted = normalizeScope(scope);
      if (wanted.length === 0) {
        // FAIL-CLOSED: certifying an unchecked state ("nothing declared, so
        // nothing collides") is exactly the rubber-stamp this tool exists to
        // prevent. Ask the caller to declare what they intend to touch.
        throw new Error(
          "--scope is required for guard: an empty scope would certify a state that was never checked. " +
            "List the files or directories you intend to edit."
        );
      }
      const conflicts = scopeConflicts(scope, { agent, taskId });
      return { ok: conflicts.length === 0, scope: wanted, conflicts };
    },

    /** Create a new task in the backlog ('available') without taking an active lease. */
    create({ id, title, scope, priority = "P2", dependsOn = [], createdBy = "AnonymousAgent" } = {}) {
      if (!id) throw new Error("--id is required for create.");
      return withLock(() => {
        const tasks = readTasks();
        if (tasks.some((task) => task.id === id)) {
          throw new Error(`Task '${id}' already exists.`);
        }
        const task = {
          id,
          priority: String(priority || "P2").toUpperCase(),
          title: title || id,
          scope: normalizeScope(scope),
          status: "available",
          dependsOn: normalizeDependencies(dependsOn),
          createdBy,
          createdAt: new Date().toISOString(),
        };
        tasks.push(task);
        writeJsonAtomic(tasksFile, tasks);
        return { ok: true, id, task };
      });
    },

    /** Take a lease. Returns {ok:false, conflicts} or {ok:false, blocked:true} instead of throwing on collision or unsatisfied dependencies. */
    claim({ id, agent = "AnonymousAgent", scope, minutes = DEFAULT_LEASE_MINUTES, title, summary = "", create = false, priority = "P2", dependsOn = [] }) {
      if (!id) throw new Error("--id is required for claim.");
      const conflicts = scopeConflicts(scope, { agent, taskId: id });
      if (conflicts.length > 0) return { ok: false, conflicts, id };

      const leaseMinutes = Number(minutes) || DEFAULT_LEASE_MINUTES;
      return withLock(() => {
        const tasks = readTasks();
        const existing = tasks.find((task) => task.id === id);

        const declaredDeps = existing
          ? (Array.isArray(existing.dependsOn) ? existing.dependsOn : [])
          : normalizeDependencies(dependsOn);

        if (declaredDeps.length > 0) {
          const pendingDeps = declaredDeps.filter((depId) => {
            const depTask = tasks.find((t) => t.id === depId);
            return !depTask || depTask.status !== "done";
          });
          if (pendingDeps.length > 0) {
            return {
              ok: false,
              id,
              blocked: true,
              pendingDependencies: pendingDeps,
              conflicts: [],
            };
          }
        }

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
            dependsOn: declaredDeps,
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
        const existingClaim = readClaim(claimFile);
        if (existingClaim) {
          if (!String(agent ?? "").trim()) {
            const error = new Error(
              `--agent is required to finish '${id}': the lease is held by '${existingClaim.agent}'. ` +
                "Closure must be attributable to the agent doing it."
            );
            error.code = "LEASE_AGENT_REQUIRED";
            throw error;
          }
          if (existingClaim.agent && existingClaim.agent !== agent) {
            const error = new Error(
              `Lease for '${id}' is held by agent '${existingClaim.agent}'; refusing to finish it as '${agent}'. ` +
                "Coordinate with the holder or release your own lease instead."
            );
            error.code = "LEASE_HELD_BY_OTHER_AGENT";
            throw error;
          }
          writeJsonAtomic(path.join(historyDir, `${id}-${Date.now()}.json`), {
            ...existingClaim,
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
        return { ok: true, id, archived: Boolean(existingClaim), closed: Boolean(task), result, reason };
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

    /** Drop a lease without completing the task. Only the lease holder may release it. */
    release({ id, agent }) {
      if (!id) throw new Error("--id is required.");
      return withLock(() => {
        const claimFile = path.join(claimsDir, `${id}.json`);
        const existingClaim = readClaim(claimFile);
        if (existingClaim) {
          if (!String(agent ?? "").trim()) {
            const error = new Error(
              `--agent is required to release '${id}': the lease is held by '${existingClaim.agent}'.`
            );
            error.code = "LEASE_AGENT_REQUIRED";
            throw error;
          }
          if (existingClaim.agent && existingClaim.agent !== agent) {
            const error = new Error(
              `Lease for '${id}' is held by agent '${existingClaim.agent}'; '${agent}' cannot release it.`
            );
            error.code = "LEASE_HELD_BY_OTHER_AGENT";
            throw error;
          }
          fs.unlinkSync(claimFile);
        }
        const tasks = readTasks();
        const task = tasks.find((item) => item.id === id);
        if (task && task.status === "in_progress") {
          task.status = "available";
          delete task.assignedTo;
          writeJsonAtomic(tasksFile, tasks);
        }
        return { ok: true, id, released: Boolean(existingClaim) };
      });
    },

    audit() {
      ensureDirs();
      const tasks = readTasks();
      const seen = new Set();
      const errors = [];
      const taskMap = new Map();

      for (const task of tasks) {
        if (!task.id) errors.push("Task without ID found!");
        else if (seen.has(task.id)) errors.push(`Duplicate task ID found: '${task.id}'`);
        else {
          seen.add(task.id);
          taskMap.set(task.id, task);
        }
      }

      // Check broken references and self-dependencies
      for (const task of tasks) {
        if (!task.id) continue;
        const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
        for (const depId of deps) {
          if (depId === task.id) {
            errors.push(`Task '${task.id}' cannot depend on itself.`);
          } else if (!taskMap.has(depId)) {
            errors.push(`Broken dependency in '${task.id}': referenced task '${depId}' does not exist.`);
          }
        }
      }

      // Detect dependency cycles
      const visited = new Set();
      const recStack = new Set();
      const reportedCycles = new Set();

      function dfs(currentId, pathHistory) {
        visited.add(currentId);
        recStack.add(currentId);
        const task = taskMap.get(currentId);
        const deps = task && Array.isArray(task.dependsOn) ? task.dependsOn : [];

        for (const depId of deps) {
          if (!taskMap.has(depId)) continue;
          if (!visited.has(depId)) {
            dfs(depId, [...pathHistory, depId]);
          } else if (recStack.has(depId)) {
            const cyclePath = [...pathHistory.slice(pathHistory.indexOf(depId)), depId];
            const cycleKey = [...cyclePath].sort().join("->");
            if (!reportedCycles.has(cycleKey)) {
              reportedCycles.add(cycleKey);
              errors.push(`Dependency cycle detected: ${cyclePath.join(" -> ")}`);
            }
          }
        }
        recStack.delete(currentId);
      }

      for (const taskId of taskMap.keys()) {
        if (!visited.has(taskId)) {
          dfs(taskId, [taskId]);
        }
      }

      return { ok: errors.length === 0, count: tasks.length, errors };
    },

    /** The board as data, for a caller that wants to render it itself. */
    board() {
      const tasks = readTasks();
      const claims = activeClaims();
      const enrichedTasks = tasks.map((task) => {
        const isAvailable = task.status === "available";
        const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
        const pendingDeps = deps.filter((depId) => {
          const dep = tasks.find((t) => t.id === depId);
          return !dep || dep.status !== "done";
        });
        const effectiveStatus = isAvailable && pendingDeps.length > 0 ? "waiting" : task.status || "unknown";
        return {
          ...task,
          effectiveStatus,
          pendingDependencies: pendingDeps,
        };
      });
      return { tasks: enrichedTasks, claims: claims.map(({ isExpired, ...claim }) => ({ ...claim, expired: isExpired === true })) };
    },
  };
}
