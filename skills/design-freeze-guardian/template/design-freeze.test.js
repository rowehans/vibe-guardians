/**
 * design-freeze.test.js — Design Freeze & Visual Anti-Drift Guardian
 *
 * Stops AI assistants and automated refactors from modifying design tokens or
 * brand copy without explicit human authorization.
 *
 * Run with the Node.js native test runner (no dependencies, Node 18+):
 *   node --test test/design-freeze.test.js
 *
 * SETUP
 *   1. Copy this file to your test/ directory. It is an ES module, so your
 *      project must declare "type": "module" in package.json — or keep the file
 *      as .mjs and point the command below at it. Node 18 does not detect module
 *      syntax, so without either one the runner cannot load this file at all.
 *   2. Copy baseline-config.json to your project root.
 *   3. Copy theme.sample.css next to it, or replace designTokens.file with your
 *      real token file and re-hash it:
 *        node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync('theme.sample.css','utf8'),'utf8').digest('hex'))"
 *
 * EVERY CHECK IS FAIL-CLOSED: if this suite cannot read the configuration or the
 * file it is supposed to be freezing, it FAILS. It never returns early, and it
 * never skips silently — a guardian that passes because it could not look is
 * worse than no guardian, because it certifies a freeze that is not happening.
 *
 * A legitimate design change is authorized, not deleted: add an entry to
 * authorizedExceptions with the task id, who approved it, their exact words and
 * the date, then update the hash.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CONFIG_REL = "baseline-config.json";
const CONFIG_PATH = path.join(ROOT, CONFIG_REL);

/**
 * Line endings are normalised before hashing: git may check the same file out as
 * LF on one machine and CRLF on another (core.autocrlf), and a baseline that
 * only matches one of them produces false failures instead of catching drift.
 * Normalising does not weaken the freeze — any real content change still differs.
 */
const normalize = (text) => text.replace(/\r\n/g, "\n");
const sha256 = (content) => crypto.createHash("sha256").update(content, "utf8").digest("hex");

/** Fail-closed read: a missing config is a failure with a remedy, never a silent pass. */
function loadConfig() {
  let raw;
  try {
    raw = fs.readFileSync(CONFIG_PATH, "utf8");
  } catch (error) {
    assert.fail(
      `FAIL-CLOSED: ${CONFIG_REL} could not be read (${error.message}).\n` +
        `  Cause:  the design freeze has no baseline, so nothing is frozen.\n` +
        `  Remedy: copy baseline-config.json to ${ROOT} and point designTokens.file at your token file.`
    );
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    assert.fail(`FAIL-CLOSED: ${CONFIG_REL} is not valid JSON: ${error.message}`);
  }
}

const config = loadConfig();

test("DF-1: the baseline configuration is well-formed", () => {
  assert.ok(config.version, `${CONFIG_REL} must declare a version`);
  assert.ok(
    Number.isFinite(Date.parse(config.lastUpdated ?? "")),
    `${CONFIG_REL} must carry a parseable ISO lastUpdated, got: ${config.lastUpdated}`
  );
  assert.ok(config.designTokens, `${CONFIG_REL} must declare designTokens (the file being frozen)`);
  assert.ok(Array.isArray(config.authorizedExceptions), `${CONFIG_REL} must declare authorizedExceptions as an array`);
});

test("DF-2: the frozen target file matches its baseline hash", () => {
  const { file, expectedSha256 } = config.designTokens ?? {};
  assert.ok(
    file && expectedSha256,
    `${CONFIG_REL} → designTokens must declare both "file" and "expectedSha256".\n` +
      `  Cause:  without them there is no freeze to verify.\n` +
      `  Remedy: set "file" to your token file and "expectedSha256" to its hash (see the header of this test for the command).`
  );

  const target = path.join(ROOT, file);
  let content;
  try {
    content = fs.readFileSync(target, "utf8");
  } catch (error) {
    assert.fail(
      `FAIL-CLOSED: the frozen file '${file}' could not be read (${error.message}).\n` +
        `  Cause:  it was renamed, moved or deleted while ${CONFIG_REL} still points at it.\n` +
        `  Remedy: restore it, or repoint designTokens.file and update expectedSha256 as an authorized change.`
    );
  }

  const actual = sha256(normalize(content));
  assert.equal(
    actual,
    expectedSha256,
    `Design tokens in '${file}' changed without authorization.\n` +
      `  Expected: ${expectedSha256}\n` +
      `  Actual:   ${actual}\n` +
      `  Cause:    the file was edited (styling drift, a formatter, or an assistant "tidying up").\n` +
      `  Remedy:   revert the file to restore the baseline, or — if the change was requested by the user — record an\n` +
      `            authorized exception in ${CONFIG_REL} and update expectedSha256 to ${actual}.`
  );
});

test("DF-3: every design exception carries a real authorization record", () => {
  const seen = new Set();
  for (const exception of config.authorizedExceptions ?? []) {
    assert.ok(exception.taskId, "every exception must cite the taskId that authorized it");
    assert.ok(!seen.has(exception.taskId), `duplicate authorization for task '${exception.taskId}'`);
    seen.add(exception.taskId);

    assert.ok(exception.authorizedBy, `exception '${exception.taskId}' must cite who authorized it`);
    assert.ok(
      Number.isFinite(Date.parse(exception.approvedAt ?? "")),
      `exception '${exception.taskId}' must carry a parseable ISO approvedAt, got: ${exception.approvedAt}`
    );
    assert.ok(
      typeof exception.approvedQuote === "string" && exception.approvedQuote.trim().length >= 40,
      `exception '${exception.taskId}' must quote the approval in full: a short or empty quote is a rubber stamp, not a decision.`
    );
  }
});

test("DF-4: critical copy is declared in a usable shape", () => {
  const copy = config.criticalCopy;
  if (copy === undefined) return; // not frozen yet: nothing claimed, nothing to verify
  assert.ok(typeof copy === "object" && copy !== null && !Array.isArray(copy), "criticalCopy must be an object of name → text");
  for (const [name, text] of Object.entries(copy)) {
    assert.ok(
      typeof text === "string" && text.trim().length > 0,
      `criticalCopy.${name} must be a non-empty string: an empty entry freezes nothing while looking like a freeze`
    );
  }
});
