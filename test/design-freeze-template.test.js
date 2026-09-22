// ============================================================================
//  test/design-freeze-template.test.js — the shipped template must FAIL CLOSED
//
//  WHY THIS EXISTS: the first version of skills/design-freeze-guardian/template/
//  design-freeze.test.js returned early ("if the config is missing, return") when
//  it could not read its baseline. Applied to this repository, that guardian
//  would have reported a perfect freeze while verifying nothing — the exact
//  failure mode this project exists to prevent, hidden inside the project.
//
//  So the template is now scaffolded into a real temporary project here and made
//  to run for real, in both directions: green when the baseline holds, failing
//  when it cannot verify. A template that silently passes when blind is not a
//  template; it is a false certificate.
//
//  It also pins the Windows trap: git may check the same file out as CRLF, so the
//  template normalises line endings before hashing. Without that, every consumer
//  on Windows gets a false failure and learns to distrust the guardian.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const TEMPLATE_REL = "skills/design-freeze-guardian/template/design-freeze.test.js";
const SAMPLE_CSS_REL = "skills/design-freeze-guardian/template/theme.sample.css";

const normalize = (text) => text.replace(/\r\n/g, "\n");
const sha256 = (text) => crypto.createHash("sha256").update(normalize(text), "utf8").digest("hex");

const sampleCss = () => fs.readFileSync(path.join(ROOT, SAMPLE_CSS_REL), "utf8");

const baseConfig = (expectedSha256) => ({
  version: 1,
  lastUpdated: "2026-09-22T00:00:00.000Z",
  designTokens: { file: "theme.css", expectedSha256 },
  criticalCopy: { loginButton: "Sign In" },
  authorizedExceptions: [
    {
      taskId: "INIT-001",
      authorizedBy: "maintainers",
      approvedQuote: "Initial design freeze baseline captured from the approved build before any assistant touched the UI.",
      approvedAt: "2026-09-22T00:00:00.000Z",
    },
  ],
});

/**
 * A spawned `node --test` must not inherit the test-runner context: when
 * NODE_TEST_CONTEXT leaks into the grandchild it behaves as a test worker with no
 * channel to report on, exits 0 WITHOUT RUNNING ANY TEST, and every "this must
 * fail" assertion below would be fooled into thinking the guard passed. Found
 * while dogfooding this suite (it was silently green for exactly that reason).
 * NODE_OPTIONS goes too: a stray --test flag there has the same effect.
 */
const childEnv = () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  return env;
};

/**
 * Scaffold a throwaway project containing the shipped template, then run it for
 * real. Fail-closed on a mute child: if the spawned runner reports no tests at
 * all, that is a failure of the harness, not a pass of the template.
 */
const runTemplate = ({ config, files = {} }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "df-template-"));
  fs.mkdirSync(path.join(dir, "test"));
  fs.copyFileSync(path.join(ROOT, TEMPLATE_REL), path.join(dir, "test", "design-freeze.test.js"));
  // The template is an ES module. Node 18 does not detect module syntax, so a
  // project that never declares its module system cannot load it at all — which
  // is how this scaffold, not the template, turned CI red on Node 18 while 20 and
  // 22 (which auto-detect) stayed green. Declaring it is part of the setup.
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify({ name: "df-template-fixture", private: true, type: "module" }, null, 2)}\n`
  );
  if (config !== undefined) {
    fs.writeFileSync(path.join(dir, "baseline-config.json"), typeof config === "string" ? config : JSON.stringify(config, null, 2));
  }
  for (const [rel, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, rel), content);
  }
  const result = spawnSync(process.execPath, ["--test", path.join(dir, "test", "design-freeze.test.js")], {
    cwd: dir,
    encoding: "utf8",
    env: childEnv(),
  });
  fs.rmSync(dir, { recursive: true, force: true });

  const output = `${result.stdout}${result.stderr}`;

  /**
   * The runner reports in two different formats — the spec reporter (ℹ tests N)
   * on a terminal and TAP ("ok N - name") when stdout is a pipe, which is what
   * CI gets. Reading only one of them made this harness call a perfectly healthy
   * child "mute" on Linux; both are read so the verdict cannot depend on how the
   * output happens to be captured.
   */
  const count = (pattern) => (output.match(pattern) ?? []).length;
  const specTests = output.match(/^ℹ tests (\d+)/m);
  const summary = specTests
    ? {
        tests: Number(specTests[1]),
        pass: Number(output.match(/^ℹ pass (\d+)/m)?.[1] ?? -1),
        fail: Number(output.match(/^ℹ fail (\d+)/m)?.[1] ?? -1),
      }
    : {
        tests: count(/^\s*(?:not )?ok \d+ - /gm),
        pass: count(/^\s*ok \d+ - /gm),
        fail: count(/^\s*not ok \d+ - /gm),
      };
  assert.ok(
    summary.tests > 0,
    `FAIL-CLOSED: the spawned runner reported no tests (status ${result.status}), so its result means nothing — a leaked NODE_TEST_CONTEXT makes a child exit 0 without running anything.\n${output}`
  );
  return { status: result.status, output, summary };
};

test("DFT-1: the template runs on Node builtins alone (no dependency is added to a consumer's project)", () => {
  const source = fs.readFileSync(path.join(ROOT, TEMPLATE_REL), "utf8");
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(imports.length >= 4, "the template should import the builtins it uses");
  const foreign = imports.filter((specifier) => !specifier.startsWith("node:"));
  assert.deepEqual(foreign, [], `the template must import only node: builtins, found: ${foreign.join(", ")}`);
});

test("DFT-2: a configured project passes — the freeze is green when the baseline holds", () => {
  const css = sampleCss();
  const { status, output, summary } = runTemplate({ config: baseConfig(sha256(css)), files: { "theme.css": css } });
  assert.equal(status, 0, `the template failed on a clean project:\n${output}`);
  assert.equal(summary.fail, 0, "no check of the template may fail on a clean project");
  assert.ok(summary.pass >= 4, `expected the template's full suite to run, only ${summary.pass} checks passed`);
});

test("DFT-3: a missing baseline FAILS instead of passing blind (the fail-open bug this test exists for)", () => {
  const { status, output } = runTemplate({ files: { "theme.css": sampleCss() } });
  assert.notEqual(status, 0, "with no baseline-config.json the template must fail: passing means it certified a freeze it never checked");
  assert.match(output, /baseline-config\.json/, "the failure must name the file the user has to create");
  assert.match(output, /FAIL-CLOSED/, "the failure must say it failed closed, so the reason is unmistakable");
});

test("DFT-4: a baseline that declares no frozen file FAILS instead of verifying nothing", () => {
  const config = { ...baseConfig(undefined), designTokens: {} };
  const { status, output } = runTemplate({ config, files: { "theme.css": sampleCss() } });
  assert.notEqual(status, 0, "a baseline without designTokens.file/expectedSha256 verifies nothing and must fail");
  assert.match(output, /designTokens/, "the failure must name the missing configuration");
});

test("DFT-5: a declared file that does not exist FAILS and names it", () => {
  const { status, output } = runTemplate({ config: baseConfig(sha256("anything")), files: {} });
  assert.notEqual(status, 0, "a target that cannot be read must fail: the freeze cannot verify what is not there");
  assert.match(output, /theme\.css/, "the failure must name the file it could not read");
});

test("DFT-6: unauthorized token drift FAILS, reporting both hashes and the remedy", () => {
  const css = sampleCss();
  const { status, output } = runTemplate({
    config: baseConfig(sha256(css)),
    files: { "theme.css": css.replace("--color-accent: #7c5cff;", "--color-accent: #ff0000;") },
  });
  assert.notEqual(status, 0, "an unauthorized styling change must break the build");
  assert.match(output, /Expected:/, "the diagnostic must show the baseline hash");
  assert.match(output, /Actual:/, "the diagnostic must show the hash that was found");
  assert.match(output, /Remedy:/, "the diagnostic must tell the reader what to do, not only that it failed");
  assert.match(output, /authorized exception|revert/i, "the remedy must offer both the legitimate and the corrective path");
});

test("DFT-7: an exception without a real authorization FAILS", () => {
  const css = sampleCss();
  const config = baseConfig(sha256(css));
  config.authorizedExceptions = [{ taskId: "X-1", authorizedBy: "", approvedQuote: "ok", approvedAt: "not-a-date" }];
  const { status, output } = runTemplate({ config, files: { "theme.css": css } });
  assert.notEqual(status, 0, "an exception with no authorizer, no quote and no date must be rejected as a rubber stamp");
  assert.match(output, /X-1/, "the failure must name the offending exception");
});

test("DFT-8: a CRLF checkout still matches the baseline (Windows must not produce false failures)", () => {
  const css = sampleCss();
  const crlf = css.replace(/\n/g, "\r\n");
  assert.ok(crlf.includes("\r\n"), "the fixture must actually contain CRLF endings");
  const { status, output } = runTemplate({ config: baseConfig(sha256(css)), files: { "theme.css": crlf } });
  assert.equal(
    status,
    0,
    `a CRLF checkout must verify against an LF baseline: normalising line endings is what keeps the guardian trustworthy on Windows.\n${output}`
  );
});
