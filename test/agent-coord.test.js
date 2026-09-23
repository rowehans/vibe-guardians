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
