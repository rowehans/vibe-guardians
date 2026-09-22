// ============================================================================
//  test/repo.design-freeze.test.js — this repository's own design freeze
//
//  This is the `design-freeze-guardian` skill applied to vibe-guardians itself,
//  following the protocol in skills/design-freeze-guardian/SKILL.md and the
//  baseline-config.json schema that skill prescribes.
//
//  WHAT IS FROZEN: the brand palette, the three brand gradients (in role order),
//  the critical copy, and the dimensions of the rendered PNGs — across the
//  README banner, the social preview and the human-facing documents. An
//  assistant fixing an unrelated bug cannot restyle the project or rewrite its
//  claims; a change to any of it must arrive through an authorized exception in
//  baseline-config.json, quoted and dated.
//
//  WHY IT IS RICHER THAN THE SHIPPED TEMPLATE: the template hashes a whole file,
//  which makes every legitimate edit a failure, and it returns early when its
//  config or target is missing — a silent skip, the exact failure mode this
//  project exists to prevent. Here the freeze works at token level (a palette
//  role, a gradient order, a copy string), so ordinary editing is free and only
//  identity drift fails; and every unverifiable condition FAILS, loudly. The
//  finding is recorded in CHANGELOG.md and the template was fixed to match.
//
//  NOT PUBLISHED: this suite freezes repository assets that do not travel in the
//  npm package. Suites that only make sense in this repository are named
//  `test/repo.*.test.js` and are left out of the files allowlist in package.json
//  (enforced by DS-4 in test/discovery-surface.test.js) — the shared `test/*.test.js`
//  glob keeps `npm test` working identically in the repo and in the tarball.
//  It runs in `npm test` like every other guardian.
//
//  Prefix: DFR-* (DF-* belongs to the shipped template).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CONFIG_REL = "baseline-config.json";
const CONFIG_PATH = path.join(ROOT, CONFIG_REL);

/** Fail-closed read: a missing or empty file is a failure, never a skip. */
const readRequired = (rel, label) => {
  let content;
  try {
    content = fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch (error) {
    assert.fail(
      `FAIL-CLOSED: the design freeze cannot verify '${label}' (${rel}): ${error.message}\n` +
        `  Cause:  the frozen subject is missing, so the baseline is unverifiable.\n` +
        `  Remedy: restore the file, or remove it from designTokens.files in ${CONFIG_REL} as an authorized change.`
    );
  }
  assert.ok(content.trim().length > 0, `FAIL-CLOSED: '${label}' (${rel}) is empty, so nothing is frozen`);
  return content.replace(/\r\n/g, "\n");
};

const config = (() => {
  let raw;
  try {
    raw = fs.readFileSync(CONFIG_PATH, "utf8");
  } catch (error) {
    assert.fail(
      `FAIL-CLOSED: ${CONFIG_REL} is required by the design freeze and could not be read: ${error.message}`
    );
  }
  try {
    return JSON.parse(raw.replace(/\r\n/g, "\n"));
  } catch (error) {
    assert.fail(`FAIL-CLOSED: ${CONFIG_REL} is not valid JSON: ${error.message}`);
  }
})();

const tokens = config.designTokens ?? {};
const paletteRoles = tokens.palette ?? {};
const rolesByColor = new Map(Object.entries(paletteRoles).map(([role, color]) => [String(color).toLowerCase(), role]));

/** Every #rrggbb in the file, with the 1-based line where it first appears. */
const hexesWithLines = (content) => {
  const found = new Map();
  content.split("\n").forEach((line, index) => {
    for (const match of line.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
      const color = match.toLowerCase();
      if (!found.has(color)) found.set(color, index + 1);
    }
  });
  return found;
};

const lineOf = (content, needle) => {
  const at = content.split("\n").findIndex((line) => line.includes(needle));
  return at === -1 ? null : at + 1;
};

/** Linear gradients keyed by id, stop colors in document order. */
const gradientsOf = (content) => {
  const gradients = new Map();
  for (const block of content.matchAll(/<linearGradient\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/g)) {
    gradients.set(block[1], [...block[2].matchAll(/stop-color="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase()));
  }
  return gradients;
};

const pngSize = (buffer) => {
  assert.ok(buffer.slice(1, 4).toString() === "PNG", "not a PNG file");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

const assets = () => (tokens.files ?? []).map((rel) => ({ rel, content: readRequired(rel, "a frozen design asset") }));

test("DFR-1: the baseline configuration is present, well-formed and complete", () => {
  assert.equal(config.version, 1, `${CONFIG_REL} must declare version 1`);
  assert.ok(
    Number.isFinite(Date.parse(config.lastUpdated)),
    `${CONFIG_REL} must carry a parseable ISO lastUpdated, got: ${config.lastUpdated}`
  );
  assert.ok(Array.isArray(tokens.files) && tokens.files.length >= 2, "designTokens.files must list the frozen assets");
  assert.ok(Object.keys(paletteRoles).length > 0, "designTokens.palette must declare named roles");
  assert.ok(tokens.gradients && Object.keys(tokens.gradients).length > 0, "designTokens.gradients must declare the brand gradients");
  assert.ok(tokens.renders?.length >= 1, "designTokens.renders must declare the rendered exports");
  assert.ok(Object.keys(config.criticalCopy ?? {}).length > 0, "criticalCopy must freeze the copy that carries the project's claims");
  assert.ok(Array.isArray(config.authorizedExceptions), "authorizedExceptions must be an array");
});

test("DFR-2: the frozen palette has no duplicated roles and every asset exists", () => {
  const values = Object.values(paletteRoles).map((c) => String(c).toLowerCase());
  const duplicates = values.filter((color, index) => values.indexOf(color) !== index);
  assert.deepEqual(
    duplicates,
    [],
    `two roles share the same color (${duplicates.join(", ")}), which hides a missing token: a role must name a distinct color`
  );

  for (const { rel } of assets()) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `frozen asset ${rel} does not exist`);
  }
});

test("DFR-3: no asset uses a colour that is not a declared palette role", () => {
  const authorized = new Set(rolesByColor.keys());
  const problems = [];

  for (const { rel, content } of assets()) {
    for (const [color, line] of hexesWithLines(content)) {
      if (!authorized.has(color)) {
        problems.push(
          `  ${rel}:${line} uses ${color}, which no palette role declares\n` +
            `      Cause:  an unauthorized colour was introduced (or an existing token was edited in place)\n` +
            `      Remedy: use a declared role, or authorize the change in ${CONFIG_REL} → designTokens.palette`
        );
      }
    }
  }
  assert.deepEqual(problems, [], `the brand palette drifted:\n${problems.join("\n")}`);
});

test("DFR-4: every declared palette role is actually used by every asset", () => {
  const used = new Set();
  for (const { content } of assets()) {
    for (const color of hexesWithLines(content).keys()) used.add(color);
  }
  const unused = [...rolesByColor.entries()].filter(([color]) => !used.has(color)).map(([color, role]) => `  ${role} (${color})`);
  assert.deepEqual(
    unused,
    [],
    `these palette roles are declared but used by no frozen asset, so the palette no longer describes the brand:\n${unused.join("\n")}`
  );
});

test("DFR-5: the brand gradients keep their role order in every asset", () => {
  const problems = [];
  for (const { rel, content } of assets()) {
    const gradients = gradientsOf(content);
    for (const [id, roles] of Object.entries(tokens.gradients)) {
      const expected = roles.map((role) => String(paletteRoles[role] ?? role).toLowerCase());
      const actual = gradients.get(id);
      if (!actual) {
        problems.push(`  ${rel}: gradient "${id}" is missing entirely\n      Cause: a brand gradient was removed or renamed`);
        continue;
      }
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        problems.push(
          `  ${rel}:${lineOf(content, `id="${id}"`) ?? "?"} gradient "${id}" stops are ${actual.join(" → ")} but the baseline declares ${expected.join(" → ")}\n` +
            `      Cause:  the brand gradient was reordered or recoloured\n` +
            `      Remedy: restore the order, or authorize the change in ${CONFIG_REL} → designTokens.gradients.${id}`
        );
      }
    }
  }
  assert.deepEqual(problems, [], `brand gradients drifted:\n${problems.join("\n")}`);
});

test("DFR-6: the two renders share one identity (palette and gradients cannot drift apart)", () => {
  const [first, ...rest] = assets();
  assert.ok(first, "no frozen assets to compare");
  const reference = { palette: [...hexesWithLines(first.content).keys()].sort(), gradients: gradientsOf(first.content) };

  const problems = [];
  for (const { rel, content } of rest) {
    const palette = [...hexesWithLines(content).keys()].sort();
    if (JSON.stringify(palette) !== JSON.stringify(reference.palette)) {
      const onlyHere = palette.filter((c) => !reference.palette.includes(c));
      const onlyThere = reference.palette.filter((c) => !palette.includes(c));
      problems.push(
        `  ${rel} does not share the palette of ${first.rel} (extra: ${onlyHere.join(" ") || "none"}; missing: ${onlyThere.join(" ") || "none"})`
      );
    }
    const gradients = gradientsOf(content);
    for (const [id, stops] of reference.gradients) {
      if (JSON.stringify(gradients.get(id)) !== JSON.stringify(stops)) {
        problems.push(`  ${rel} gradient "${id}" is ${(gradients.get(id) ?? []).join(" → ") || "missing"}, ${first.rel} uses ${stops.join(" → ")}`);
      }
    }
  }
  assert.deepEqual(
    problems,
    [],
    `the README banner and the social preview are two renders of one identity and must not drift apart:\n${problems.join("\n")}`
  );
});

test("DFR-7: the critical copy still says exactly what it said, everywhere it appears", () => {
  const problems = [];
  for (const [key, entry] of Object.entries(config.criticalCopy ?? {})) {
    assert.ok(entry?.text, `criticalCopy.${key} must declare the text it freezes`);
    for (const rel of entry.in ?? []) {
      const content = readRequired(rel, `criticalCopy.${key}`);
      if (!content.includes(entry.text)) {
        problems.push(
          `  ${rel} no longer contains criticalCopy.${key}: "${entry.text}"\n` +
            `      Cause:  user-visible copy was rewritten (this is the failure mode the freeze exists for)\n` +
            `      Remedy: restore the wording, or authorize the new copy in ${CONFIG_REL} → criticalCopy.${key}`
        );
      }
    }
  }
  assert.deepEqual(problems, [], `critical copy drifted:\n${problems.join("\n")}`);
});

test("DFR-8: the rendered exports match the frozen dimensions and are real images", () => {
  const problems = [];
  for (const render of tokens.renders ?? []) {
    let buffer;
    try {
      buffer = fs.readFileSync(path.join(ROOT, render.png));
    } catch (error) {
      problems.push(`  ${render.png} could not be read (${error.message})\n      Remedy: regenerate it from ${render.svg}; the repository ships the source of truth.`);
      continue;
    }
    let size;
    try {
      size = pngSize(buffer);
    } catch (error) {
      problems.push(`  ${render.png} is not a valid PNG (${error.message})`);
      continue;
    }
    if (size.width !== render.width || size.height !== render.height) {
      problems.push(
        `  ${render.png} is ${size.width}x${size.height} but the baseline declares ${render.width}x${render.height}\n` +
          `      Cause:  the export was rendered at a different size (a social preview outside 1280x640 is rejected or cropped)\n` +
          `      Remedy: re-render from ${render.svg}, or authorize the new size in ${CONFIG_REL} → designTokens.renders`
      );
    }
  }
  assert.deepEqual(problems, [], `the rendered exports drifted:\n${problems.join("\n")}`);
});

test("DFR-9: the freeze cannot be weakened into a rubber stamp", () => {
  assert.ok(
    Object.keys(paletteRoles).length >= 10,
    `the frozen palette declares only ${Object.keys(paletteRoles).length} roles: a freeze that describes almost nothing cannot fail`
  );
  assert.ok(
    Object.keys(config.criticalCopy ?? {}).length >= 4,
    "criticalCopy must keep freezing the name, the tagline, the install command and the licence name"
  );

  const seen = new Set();
  for (const exception of config.authorizedExceptions ?? []) {
    assert.ok(exception.taskId, "every exception must cite a taskId, so it can be traced back to the work that authorized it");
    assert.ok(!seen.has(exception.taskId), `duplicate authorization for task '${exception.taskId}'`);
    seen.add(exception.taskId);

    assert.ok(exception.authorizedBy, `exception '${exception.taskId}' must cite who authorized it`);
    assert.ok(
      Number.isFinite(Date.parse(exception.approvedAt)),
      `exception '${exception.taskId}' must carry a parseable ISO approvedAt, got: ${exception.approvedAt}`
    );
    assert.ok(
      typeof exception.approvedQuote === "string" && exception.approvedQuote.trim().length >= 40,
      `exception '${exception.taskId}' must quote the approval in full: an authorization shorter than 40 characters is a rubber stamp, not a decision`
    );
  }
});
