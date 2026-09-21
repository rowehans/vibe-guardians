import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectFile } from "../skills/ast-async-hygiene/template/code-hygiene.test.js";

test("HYGIENE-1: Detects empty catch block", () => {
  const code = `
    try {
      dangerousOperation();
    } catch (e) {}
  `;
  const issues = inspectFile("test.js", code);
  assert.equal(issues.some(i => i.type === "SILENT_CATCH"), true);
});

test("HYGIENE-2: Detects unawaited async mutation in expression statement", () => {
  const code = `
    async function run() {
      database.saveUser(user);
    }
  `;
  const issues = inspectFile("test.js", code);
  assert.equal(issues.some(i => i.type === "FLOATING_PROMISE"), true);
});

test("HYGIENE-3: Clean code passes with 0 defects", () => {
  const code = `
    async function run() {
      await database.saveUser(user);
      try {
        validate();
      } catch (err) {
        logger.error(err);
      }
    }
  `;
  const issues = inspectFile("test.js", code);
  assert.equal(issues.length, 0);
});
