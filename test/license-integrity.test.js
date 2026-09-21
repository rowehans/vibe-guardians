// ============================================================================
//  test/license-integrity.test.js — LICENSE cannot drift from the canonical text
//
//  WHY THIS EXISTS: this repository once shipped a LICENSE that carried the
//  official PolyForm name and URL but was a paraphrase — missing Distribution
//  License, Changes and New Works License, Patent License, Patent Defense,
//  Violations and Definitions, and inventing sections the license does not
//  have — while `package.json` and the README badge both declared the SPDX
//  `PolyForm-Noncommercial-1.0.0`. That breaks the license's own Notices
//  clause (which requires handing over *these terms* or their URL) and any
//  scanner would flag the mismatch. This suite makes that regression
//  impossible to reintroduce silently.
//
//  CONTRACT (fail-closed, no silent skips):
//    · The pinned fixture must be byte-identical to the canonical PolyForm
//      Noncommercial 1.0.0 text (git blob 5ecc88cf…). If the fixture is
//      missing, empty or edited, the pin is gone and the suite FAILS.
//    · LICENSE must be the canonical text verbatim plus exactly one
//      `Required Notice:` line. Any other difference FAILS.
//    · Coherence: package.json SPDX, README badge and README legal section
//      must all name the same license as the file. Any mismatch FAILS.
//
//  The ONLY optional check is the upstream re-pin (LIC-6): it needs network,
//  so it is opt-in via POLYFORM_UPSTREAM_CHECK=1 — and when enabled it also
//  fails closed (an unreachable upstream is a failure, not a pass).
//
//  Line endings: content is normalized CRLF→LF before hashing/comparing,
//  because git may check text files out as CRLF on Windows (core.autocrlf).
//  Normalization does not weaken tamper detection: any real text change is
//  still caught.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const LICENSE_PATH = path.join(ROOT, "LICENSE");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const README_PATH = path.join(ROOT, "README.md");
const FIXTURE_PATH = path.join(HERE, "fixtures", "polyform-noncommercial-1.0.0.md");

/** git object id of the canonical file in polyformproject/polyform-licenses (branch 1.0.0). */
const CANONICAL_BLOB = "5ecc88cfc4b1cff608ed640efe913c9dd97935c3";
const CANONICAL_UPSTREAM =
  "https://raw.githubusercontent.com/polyformproject/polyform-licenses/1.0.0/PolyForm-Noncommercial-1.0.0.md";

const OFFICIAL_TITLE = "# PolyForm Noncommercial License 1.0.0";
const OFFICIAL_URL = "<https://polyformproject.org/licenses/noncommercial/1.0.0>";
const SPDX_ID = "PolyForm-Noncommercial-1.0.0";
const REQUIRED_NOTICE = /^Required Notice: Copyright \(c\) \d{4} .+$/;

/** Headings of the paraphrase that must never come back (none of them are in the official text). */
const PARAPHRASE_MARKERS = [
  "## Purpose",
  "## Agreement",
  "## Noncommercial License",
  "## Commercial Licensing Reservation",
  "## Defense In Law",
  "## Disclaimer of Warranties",
];

const normalize = (text) => text.replace(/\r\n/g, "\n");

/** git's blob id: sha1("blob <bytes>\0" + content) — lets us compare with `git hash-object`. */
const gitBlobHash = (text) =>
  crypto.createHash("sha1").update(`blob ${Buffer.byteLength(text, "utf8")}\0`).update(text, "utf8").digest("hex");

/** Fail-closed read: a missing or empty file is a failure, never a skip. */
const readRequired = (file, label) => {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (error) {
    assert.fail(`FAIL-CLOSED: cannot read the ${label} (${file}): ${error.message}`);
  }
  assert.ok(content.trim().length > 0, `FAIL-CLOSED: the ${label} (${file}) is empty`);
  return normalize(content);
};

const canonicalText = () => readRequired(FIXTURE_PATH, "pinned canonical fixture");
const licenseText = () => readRequired(LICENSE_PATH, "LICENSE");

test("LIC-1: the pinned canonical fixture is intact (its blob matches the official PolyForm object)", () => {
  const canonical = canonicalText();
  assert.equal(
    gitBlobHash(canonical),
    CANONICAL_BLOB,
    "The fixture test/fixtures/polyform-noncommercial-1.0.0.md no longer matches the canonical PolyForm Noncommercial 1.0.0 text. Re-download it verbatim from https://raw.githubusercontent.com/polyformproject/polyform-licenses/1.0.0/PolyForm-Noncommercial-1.0.0.md and update this pin only with that exact object id."
  );
  assert.ok(canonical.startsWith(OFFICIAL_TITLE), "The canonical text must start with the official license title");
  assert.ok(canonical.includes(OFFICIAL_URL), "The canonical text must carry the official license URL");
});

test("LIC-2: LICENSE exists, is not empty, and is the PolyForm Noncommercial 1.0.0 text", () => {
  const license = licenseText();
  assert.ok(license.startsWith(OFFICIAL_TITLE), `LICENSE must start with "${OFFICIAL_TITLE}"`);
  assert.ok(license.includes(OFFICIAL_URL), `LICENSE must carry the official URL ${OFFICIAL_URL}`);
});

test("LIC-3: LICENSE is the canonical text verbatim plus exactly one Required Notice line", () => {
  const canonical = canonicalText();
  const lines = licenseText().split("\n");

  const noticeIndexes = lines.reduce((acc, line, index) => (REQUIRED_NOTICE.test(line) ? [...acc, index] : acc), []);
  assert.equal(
    noticeIndexes.length,
    1,
    `Expected exactly one "Required Notice: Copyright (c) <year> <holder>" line, found ${noticeIndexes.length}`
  );

  const noticeIndex = noticeIndexes[0];
  assert.equal(lines[noticeIndex - 1], "", "the Required Notice must be its own paragraph (blank line before it)");
  assert.equal(lines[noticeIndex + 1], "", "the Required Notice must be its own paragraph (blank line after it)");

  // Strip the notice block: what remains must be the canonical text, byte for byte.
  const stripped = lines.filter((_, index) => index !== noticeIndex && index !== noticeIndex + 1).join("\n");
  if (stripped !== canonical) {
    const strippedLines = stripped.split("\n");
    const canonicalLines = canonical.split("\n");
    const at = strippedLines.findIndex((line, index) => line !== canonicalLines[index]);
    const firstDivergence = at === -1 ? Math.min(strippedLines.length, canonicalLines.length) : at;
    const context = (arr, from) =>
      arr
        .slice(Math.max(0, from - 1), from + 2)
        .map((line, offset) => `      ${Math.max(0, from - 1) + offset + 1}| ${line}`)
        .join("\n");
    assert.fail(
      [
        "LICENSE text differs from the canonical PolyForm Noncommercial 1.0.0 outside the Required Notice line.",
        `  File:     LICENSE (line ${firstDivergence + 1} of the text without the notice)`,
        `  Cause:    the license text was edited, truncated or replaced (first divergence at line ${firstDivergence + 1})`,
        `  Expected:`,
        context(canonicalLines, firstDivergence),
        `  Actual:`,
        context(strippedLines, firstDivergence),
        "  Remedy:   restore LICENSE from the canonical text (git blob " + CANONICAL_BLOB + ") keeping only the",
        "            Required Notice line as an authorized addition.",
      ].join("\n")
    );
  }
  assert.equal(gitBlobHash(stripped), CANONICAL_BLOB, "the text without the Required Notice must be the canonical PolyForm object");
});

test("LIC-4: no paraphrased sections, and all 15 official sections are present in order", () => {
  const license = licenseText();
  for (const marker of PARAPHRASE_MARKERS) {
    assert.ok(
      !license.includes(marker),
      `LICENSE contains "${marker}", a heading of the old paraphrase that does not exist in PolyForm Noncommercial 1.0.0. Restore the canonical text.`
    );
  }

  const sectionsOf = (text) => text.split("\n").filter((line) => line.startsWith("## "));
  assert.deepEqual(
    sectionsOf(license),
    sectionsOf(canonicalText()),
    "The level-2 sections of LICENSE must match the canonical text exactly (15 sections, same order)"
  );
});

test("LIC-5: package.json SPDX, README badge and README legal section all name the same license", () => {
  const pkg = JSON.parse(readRequired(PACKAGE_PATH, "package.json"));
  assert.equal(pkg.license, SPDX_ID, `package.json must declare the SPDX id ${SPDX_ID}`);

  const readme = readRequired(README_PATH, "README.md");
  assert.ok(readme.includes("PolyForm Noncommercial License 1.0.0"), "README must name the license it ships");
  assert.ok(readme.includes("PolyForm%20Noncommercial"), "README badge must advertise the PolyForm Noncommercial license");
  assert.ok(readme.includes("](LICENSE)"), "README must link the LICENSE file");
});

test("LIC-6: [opt-in, online] the pinned blob still matches the upstream canonical file", async (t) => {
  if (process.env.POLYFORM_UPSTREAM_CHECK !== "1") {
    return t.skip("set POLYFORM_UPSTREAM_CHECK=1 to re-verify the pin against polyformproject/polyform-licenses");
  }
  let upstream;
  try {
    const response = await fetch(CANONICAL_UPSTREAM);
    assert.ok(response.ok, `upstream responded ${response.status}`);
    upstream = normalize(await response.text());
  } catch (error) {
    assert.fail(`FAIL-CLOSED: upstream re-pin was requested but could not be verified: ${error.message}`);
  }
  assert.equal(
    gitBlobHash(upstream),
    CANONICAL_BLOB,
    "Upstream PolyForm Noncommercial 1.0.0 no longer matches the pinned blob: review the official license and re-pin deliberately."
  );
});
