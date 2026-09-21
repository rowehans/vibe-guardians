/**
 * design-freeze.test.js — Design Freeze & Visual Anti-Drift Guardian
 * 
 * Verifies that AI assistants and automated refactors do not modify the visual design,
 * styling tokens, or brand copy without explicit human authorization.
 * 
 * Runs with Node.js native test runner:
 * node --test test/design-freeze.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "baseline-config.json");

function sha256(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

test("DF-1: Baseline configuration exists and is well-formed", () => {
  assert.ok(fs.existsSync(CONFIG_PATH), `baseline-config.json not found at ${CONFIG_PATH}`);
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);
  assert.ok(config.version, "config.version is required");
  assert.ok(Array.isArray(config.authorizedExceptions), "authorizedExceptions must be an array");
});

test("DF-2: Design tokens match frozen baseline hash", () => {
  if (!fs.existsSync(CONFIG_PATH)) return;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (!config.designTokens || !config.designTokens.file) return;

  const targetFile = path.join(ROOT, config.designTokens.file);
  if (!fs.existsSync(targetFile)) {
    // If the sample file does not exist in testing mode, skip or verify mock
    return;
  }
  const content = fs.readFileSync(targetFile, "utf8");
  const currentHash = sha256(content);
  assert.equal(
    currentHash,
    config.designTokens.expectedSha256,
    `Visual design tokens in '${config.designTokens.file}' were modified without authorization! Update baseline-config.json with an approved task ID.`
  );
});

test("DF-3: Every design change exception has valid authorization record", () => {
  if (!fs.existsSync(CONFIG_PATH)) return;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  for (const exc of config.authorizedExceptions) {
    assert.ok(exc.taskId, "Exception must cite a valid taskId");
    assert.ok(exc.authorizedBy, "Exception must cite authorizer");
    assert.ok(exc.approvedQuote, "Exception must cite approvedQuote text");
    assert.ok(exc.approvedAt, "Exception must cite approval timestamp");
  }
});
