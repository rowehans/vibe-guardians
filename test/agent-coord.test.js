import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ensureWorkboardLive } from "../skills/agent-coordinator/scripts/agent-coord.mjs";
import { createCoordinator } from "../skills/agent-coordinator/scripts/coord-core.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "skills", "agent-coordinator", "scripts", "agent-coord.mjs");

test("COORD-1: agent-coord status command executes cleanly", () => {
  const output = execFileSync("node", [CLI, "status"], { encoding: "utf8" });
  assert.ok(output.includes("[AGENT-COORD]"), "Output should contain [AGENT-COORD]");
});

test("COORD-2: agent-coord audit command validates board integrity", () => {
  const output = execFileSync("node", [CLI, "audit"], { encoding: "utf8" });
  assert.ok(output.includes("[AUDIT PASS]"), "Output should pass audit");
});

test("COORD-3: claim, guard collision detection, and finish lifecycle", () => {
  // Claim task
  execFileSync("node", [CLI, "claim", "--id", "TEST-TASK-01", "--agent", "AgentA", "--scope", "src/sample.js", "--minutes", "10"]);

  // Guard from another agent should fail on colliding file
  assert.throws(() => {
    execFileSync("node", [CLI, "guard", "--agent", "AgentB", "--scope", "src/sample.js"]);
  }, /Scope collision detected/);

  // Guard on different file passes
  const guardPass = execFileSync("node", [CLI, "guard", "--agent", "AgentB", "--scope", "src/other.js"], { encoding: "utf8" });
  assert.ok(guardPass.includes("[GUARD PASS]"));

  // Finish task
  execFileSync("node", [CLI, "finish", "--id", "TEST-TASK-01", "--agent", "AgentA", "--result", "Claim and guard behavior verified", "--reason", "Complete the lifecycle test"]);

  // After finish, guard should now pass on original file
  const guardAfter = execFileSync("node", [CLI, "guard", "--agent", "AgentB", "--scope", "src/sample.js"], { encoding: "utf8" });
  assert.ok(guardAfter.includes("[GUARD PASS]"));
});

test("COORD-4: task closure requires a result and reason", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-finish-"));
  try {
    assert.throws(() => execFileSync("node", [CLI, "finish", "--id", "TASK-MISSING", "--agent", "AgentA", "--reason", "Why"], {
      cwd: root, encoding: "utf8", stdio: "pipe",
    }), (error) => error.status === 1 && String(error.stderr).includes("--result is required"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("COORD-5: review appends reviewer evidence without replacing task authorship", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-review-"));
  try {
    const coord = createCoordinator(root);
    coord.claim({ id: "TASK-REVIEW", agent: "OriginalAgent", scope: "src/a.js", create: true, title: "Original title" });
    coord.finish({ id: "TASK-REVIEW", agent: "OriginalAgent", result: "Implemented tests", reason: "Prevent regressions" });
    const reviewed = coord.review({ id: "TASK-REVIEW", reviewer: "ReviewerAgent", summary: "Verified behavior", reason: "Tests and audit passed" });
    const task = coord.board().tasks.find((item) => item.id === "TASK-REVIEW");
    assert.equal(reviewed.ok, true);
    assert.equal(task.createdBy, "OriginalAgent");
    assert.equal(task.closedBy, "OriginalAgent");
    assert.equal(task.title, "Original title");
    assert.equal(task.reviews[0].reviewedBy, "ReviewerAgent");
    assert.equal(task.reviews[0].summary, "Verified behavior");
    assert.equal(task.reviews[0].reason, "Tests and audit passed");
    const output = execFileSync("node", [CLI, "review", "--id", "TASK-REVIEW", "--reviewer", "SecondReviewer", "--summary", "Checked the generated board", "--reason", "Confirm attribution remains intact"], { cwd: root, encoding: "utf8" });
    assert.match(output, /reviewed by 'SecondReviewer'/);
    assert.match(execFileSync("node", [CLI, "board"], { cwd: root, encoding: "utf8" }), /Reviewed by SecondReviewer/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("WORKBOARD-1: repositories without a workboard remain unaffected", async () => {
  const result = await ensureWorkboardLive({ cwd: ROOT, probe: async () => { throw new Error("probe should not run"); } });
  assert.deepEqual(result, { available: false, started: false });
});

test("WORKBOARD-2: agent coordination starts a consumer workboard when its port is down", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-workboard-"));
  fs.mkdirSync(path.join(cwd, "scripts"));
  fs.writeFileSync(path.join(cwd, "scripts", "workboard-serve.mjs"), "", "utf8");
  const calls = [];
  try {
    const result = await ensureWorkboardLive({
      cwd,
      probe: async () => false,
      spawnProcess: (...args) => { calls.push(args); return { unref() {} }; },
    });
    assert.equal(result.started, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][1], [path.join(cwd, "scripts", "workboard-serve.mjs"), "--port", "4319"]);
    assert.equal(calls[0][2].detached, true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("WORKBOARD-3: an already-live consumer workboard is not duplicated", async () => {
  let spawned = false;
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-workboard-live-"));
  fs.mkdirSync(path.join(cwd, "scripts"));
  fs.writeFileSync(path.join(cwd, "scripts", "workboard-serve.mjs"), "", "utf8");
  try {
    const result = await ensureWorkboardLive({
      cwd,
      probe: async () => true,
      spawnProcess: () => { spawned = true; return { unref() {} }; },
    });
    assert.deepEqual(result, { available: true, started: false });
    assert.equal(spawned, false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("COORD-6: an expired lease stops blocking guard and claim", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-expired-"));
  try {
    const coord = createCoordinator(root);
    // minutes is negative on purpose: the lease is born already expired.
    coord.claim({ id: "TASK-GHOST", agent: "GhostAgent", scope: "src/ghost.js", minutes: -1 });

    // Another agent's guard must not be blocked by a dead lease.
    const verdict = coord.guard({ agent: "AgentB", scope: "src/ghost.js" });
    assert.equal(verdict.ok, true, "an expired lease must not collide");

    // And the freed scope can be claimed again.
    const taken = coord.claim({ id: "TASK-NEXT", agent: "AgentB", scope: "src/ghost.js", minutes: 5 });
    assert.equal(taken.ok, true, "an expired lease's scope must be claimable");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("COORD-7: guard without a declared scope fails closed instead of rubber-stamping", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-emptyguard-"));
  try {
    const coord = createCoordinator(root);
    assert.throws(() => coord.guard({ agent: "AgentA", scope: "" }), /--scope is required/);
    assert.throws(() => coord.guard({ agent: "AgentA" }), /--scope is required/);

    // The CLI surfaces it as a clean non-zero exit with the remedy attached.
    assert.throws(
      () => execFileSync("node", [CLI, "guard", "--agent", "AgentA"], { cwd: root, encoding: "utf8", stdio: "pipe" }),
      (error) => error.status === 1 && String(error.stderr).includes("--scope is required")
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("COORD-8: finish and release demand the lease holder's identity", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-ownership-"));
  try {
    const coord = createCoordinator(root);
    coord.claim({ id: "TASK-OWN", agent: "OwnerA", scope: "src/own.js", minutes: 5, create: true, title: "Owned task" });

    // A different agent cannot close or drop someone else's lease...
    assert.throws(
      () => coord.finish({ id: "TASK-OWN", agent: "ImpostorB", result: "r", reason: "w" }),
      /held by agent 'OwnerA'/
    );
    assert.throws(() => coord.release({ id: "TASK-OWN", agent: "ImpostorB" }), /cannot release it/);

    // ...and an anonymous closure is refused outright.
    assert.throws(() => coord.finish({ id: "TASK-OWN", result: "r", reason: "w" }), /--agent is required/);
    assert.throws(() => coord.release({ id: "TASK-OWN" }), /--agent is required/);

    // The holder can close, and the attribution is theirs.
    coord.finish({ id: "TASK-OWN", agent: "OwnerA", result: "Implemented and verified", reason: "Prevent regressions" });
    const task = coord.board().tasks.find((item) => item.id === "TASK-OWN");
    assert.equal(task.closedBy, "OwnerA");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("COORD-9: a corrupt board fails closed instead of being silently wiped", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-corrupt-"));
  try {
    const boardFile = path.join(root, ".agent-coord", "tasks.json");
    fs.mkdirSync(path.join(root, ".agent-coord"), { recursive: true });
    fs.writeFileSync(boardFile, "{ this is not json", "utf8");

    const coord = createCoordinator(root);
    assert.throws(() => coord.status(), /not valid JSON/);
    assert.throws(() => coord.audit(), /not valid JSON/);

    // The CLI turns the integrity emergency into a non-zero exit, naming the file.
    assert.throws(
      () => execFileSync("node", [CLI, "status"], { cwd: root, encoding: "utf8", stdio: "pipe" }),
      (error) => error.status === 1 && String(error.stderr).includes("tasks.json")
    );

    // The corrupt file is still there afterwards: no command "repaired" it by emptying it.
    assert.equal(fs.readFileSync(boardFile, "utf8"), "{ this is not json");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("COORD-10: scope collisions respect path boundaries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-boundaries-"));
  try {
    const coord = createCoordinator(root);

    // File lease: siblings that share a string prefix are NOT collisions.
    coord.claim({ id: "T-FILE", agent: "AgentA", scope: "src/app.js", minutes: 5 });
    assert.equal(coord.guard({ agent: "AgentB", scope: "src/app.test.js" }).ok, true);
    assert.equal(coord.guard({ agent: "AgentB", scope: "src/app.js.bak" }).ok, true);
    assert.equal(coord.guard({ agent: "AgentB", scope: "src/app.js" }).ok, false, "exact file must collide");

    // Directory lease: covers everything below it, but not sibling names.
    coord.claim({ id: "T-DIR", agent: "AgentC", scope: "src/lib", minutes: 5 });
    assert.equal(coord.guard({ agent: "AgentB", scope: "src/lib/deep/module.js" }).ok, false, "child of a leased dir must collide");
    assert.equal(coord.guard({ agent: "AgentB", scope: "src/libx/file.js" }).ok, true, "sibling dir sharing a prefix must not collide");
    assert.equal(coord.guard({ agent: "AgentB", scope: "src" }).ok, false, "a parent dir lease must collide");

    // Canonical form: ./ prefixes and Windows separators compare as the same path.
    assert.equal(coord.guard({ agent: "AgentB", scope: "./src/lib" }).ok, false);
    coord.release({ id: "T-FILE", agent: "AgentA" });
    coord.release({ id: "T-DIR", agent: "AgentC" });
    coord.claim({ id: "T-WIN", agent: "AgentD", scope: "src\\win.js", minutes: 5 });
    assert.equal(coord.guard({ agent: "AgentB", scope: "src/win.js" }).ok, false, "backslash and forward slash are the same path");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("COORD-11: a stale lock from a dead process is recovered, not fatal", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-stalelock-"));
  try {
    const coord = createCoordinator(root);
    coord.claim({ id: "T-SEED", agent: "AgentA", scope: "a.js", minutes: 5 });

    // Simulate a crash that left the coordination lock behind.
    const lockFile = path.join(root, ".agent-coord", ".lock");
    fs.writeFileSync(lockFile, JSON.stringify({ pid: 999999, at: new Date().toISOString() }), "utf8");
    const past = new Date(Date.now() - 10_000);
    fs.utimesSync(lockFile, past, past);

    // A write operation must recover the stale lock and proceed.
    const result = coord.claim({ id: "T-AFTER", agent: "AgentB", scope: "b.js", minutes: 5 });
    assert.equal(result.ok, true, "a stale lock must not wedge the coordinator");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("COORD-12: create adds task to backlog in available status without lease", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-create-"));
  try {
    const coord = createCoordinator(root);
    const created = coord.create({
      id: "TASK-BACKLOG-1",
      title: "Write migration",
      scope: "src/db.js",
      priority: "P1",
      createdBy: "ArchitectAgent",
    });

    assert.equal(created.ok, true);
    assert.equal(created.id, "TASK-BACKLOG-1");
    assert.equal(created.task.status, "available");
    assert.equal(created.task.priority, "P1");

    // Board shows task in available without any active leases
    const board = coord.board();
    assert.equal(board.tasks.length, 1);
    assert.equal(board.tasks[0].status, "available");
    assert.equal(board.claims.length, 0);

    // Duplicate ID creation is refused
    assert.throws(
      () => coord.create({ id: "TASK-BACKLOG-1", title: "Duplicate" }),
      /already exists/
    );

    // Missing ID is refused
    assert.throws(() => coord.create({ title: "No ID" }), /--id is required/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("COORD-13: claim respects dependencies and prevents premature execution", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-deps-"));
  try {
    const coord = createCoordinator(root);
    // Seed prerequisite task
    coord.create({ id: "TASK-PRE", title: "Prerequisite setup", scope: "src/setup.js" });
    // Seed dependent task
    coord.create({
      id: "TASK-POST",
      title: "Follow-up logic",
      scope: "src/logic.js",
      dependsOn: ["TASK-PRE"],
    });

    // Dependent task board status is 'waiting'
    const initialBoard = coord.board();
    const postTask = initialBoard.tasks.find((t) => t.id === "TASK-POST");
    assert.equal(postTask.effectiveStatus, "waiting");
    assert.deepEqual(postTask.pendingDependencies, ["TASK-PRE"]);

    // Attempting to claim TASK-POST while TASK-PRE is not done is blocked
    const claimAttempt = coord.claim({ id: "TASK-POST", agent: "WorkerA", scope: "src/logic.js" });
    assert.equal(claimAttempt.ok, false);
    assert.equal(claimAttempt.blocked, true);
    assert.deepEqual(claimAttempt.pendingDependencies, ["TASK-PRE"]);

    // Work and finish TASK-PRE
    coord.claim({ id: "TASK-PRE", agent: "WorkerA", scope: "src/setup.js" });
    coord.finish({ id: "TASK-PRE", agent: "WorkerA", result: "Done setup", reason: "Required" });

    // Now TASK-POST is unblocked and can be claimed
    const unblockedBoard = coord.board();
    const readyTask = unblockedBoard.tasks.find((t) => t.id === "TASK-POST");
    assert.equal(readyTask.effectiveStatus, "available");
    assert.deepEqual(readyTask.pendingDependencies, []);

    const allowedClaim = coord.claim({ id: "TASK-POST", agent: "WorkerB", scope: "src/logic.js" });
    assert.equal(allowedClaim.ok, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("COORD-14: audit detects broken references, self-dependencies, and cycles", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-guardians-auditdeps-"));
  try {
    const coord = createCoordinator(root);
    coord.create({ id: "TASK-A", title: "Task A", dependsOn: ["TASK-B"] });
    coord.create({ id: "TASK-B", title: "Task B", dependsOn: ["TASK-A"] });
    coord.create({ id: "TASK-C", title: "Task C", dependsOn: ["TASK-NONEXISTENT"] });

    const report = coord.audit();
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((err) => err.includes("referenced task 'TASK-NONEXISTENT' does not exist")));
    assert.ok(report.errors.some((err) => err.includes("Dependency cycle detected")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
