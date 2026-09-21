import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
  execFileSync("node", [CLI, "finish", "--id", "TEST-TASK-01", "--agent", "AgentA"]);

  // After finish, guard should now pass on original file
  const guardAfter = execFileSync("node", [CLI, "guard", "--agent", "AgentB", "--scope", "src/sample.js"], { encoding: "utf8" });
  assert.ok(guardAfter.includes("[GUARD PASS]"));
});
