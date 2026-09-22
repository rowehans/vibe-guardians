// ============================================================================
//  test/discovery-surface.test.js — the public surface must stay coherent
//
//  WHY THIS EXISTS: a package is discovered (or ignored) through its metadata:
//  AGENTS.md, llms.txt, skill frontmatter, package.json, badges and links. That
//  surface drifts silently — a renamed repository leaves dead URLs, a skill
//  ships without a description and becomes invisible to agents, a template slug
//  survives into the public README, an install command stops working. None of
//  that breaks a single line of logic, so no other suite catches it.
//
//  It also guards the inverse risk: this repository is public, so the surface
//  must never publish private data or absolute machine paths. The patterns here
//  are deliberately GENERIC — writing the identifiers we must not leak into a
//  public test would leak them — so they cover shapes (drive letters, home
//  directories, credential prefixes, contact addresses), not names.
//
//  Contract (fail-closed, no silent skips): a missing or empty file FAILS.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const read = (relative) => {
  const full = path.join(ROOT, relative);
  let content;
  try {
    content = fs.readFileSync(full, "utf8");
  } catch (error) {
    assert.fail(`FAIL-CLOSED: cannot read ${relative}: ${error.message}`);
  }
  assert.ok(content.trim().length > 0, `FAIL-CLOSED: ${relative} is empty`);
  return content.replace(/\r\n/g, "\n");
};

const readJson = (relative) => JSON.parse(read(relative));

const listDirs = (relative) =>
  fs
    .readdirSync(path.join(ROOT, relative), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

/**
 * Where the repository-only surface lives (issue forms, PR template). The
 * published package ships AGENTS.md, llms.txt, README, skills/ and rules/ but
 * not .github/ — see the files allowlist in package.json. Checks that read it
 * are about the repository, not the tarball, so they announce a visible skip in
 * an installed package instead of failing on files that were never shipped.
 * Everything a consumer does receive (DS-1..DS-5, DS-7, DS-8) stays unconditional.
 */
const ISSUE_TEMPLATES_DIR = ".github/ISSUE_TEMPLATE";
const isRepositoryCheckout = () => fs.existsSync(path.join(ROOT, ISSUE_TEMPLATES_DIR));

/** The repository slug every public URL must agree on. */
const readSlug = () => {
  const url = readJson("package.json").repository?.url ?? "";
  const match = url.match(/(?:git\+)?https:\/\/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?$/);
  assert.ok(match, `package.json repository.url must be a GitHub HTTPS URL, got: ${url || "(missing)"}`);
  return `${match[1]}/${match[2]}`;
};

test("DS-1: AGENTS.md exists, is directly usable, and carries the required guidance", () => {
  const agents = read("AGENTS.md");
  assert.match(agents, /^# /m, "AGENTS.md must start with an H1 title");

  const required = [
    [/npm test/, "the test command"],
    [/npm install/, "the install command"],
    [/npm pack/, "how to inspect what would be published"],
    [/##\s.*(commands|build)/i, "a build/test commands section"],
    [/##\s.*conventions/i, "a conventions section"],
    [/fail[- ]closed/i, "the fail-closed rule (the core convention of this project)"],
    [/LICENSE/, "a pointer to the license rules"],
  ];
  for (const [pattern, what] of required) {
    assert.match(agents, pattern, `AGENTS.md is missing ${what}`);
  }
  assert.ok(agents.length > 800, "AGENTS.md is too thin to be useful to an agent");
});

test("DS-2: llms.txt follows the spec (one H1, a summary blockquote, linked file lists)", () => {
  const lines = read("llms.txt").split("\n");
  const firstContent = lines.findIndex((line) => line.trim().length > 0);

  assert.match(lines[firstContent], /^# \S/, "the only required section, an H1, must come first");

  const bullets = lines.filter((line) => /^\s*[-*] /.test(line));
  const summary = lines.find((line, index) => index > firstContent && line.startsWith(">"));
  assert.ok(summary, "llms.txt needs a blockquote summary right after the H1");
  assert.ok(summary.length > 80, "the summary blockquote must actually describe the project");

  const headings = lines.filter((line) => /^#{1,6} /.test(line));
  assert.equal(headings.filter((h) => /^# /.test(h)).length, 1, "llms.txt must contain exactly one H1");
  assert.deepEqual(
    headings.filter((h) => !/^# /.test(h)).filter((h) => !/^## /.test(h)),
    [],
    "llms.txt may only use H1 and H2 headings; detail sections must not be headings"
  );

  assert.ok(bullets.length >= 5, "llms.txt must list the pages an agent should read");
  for (const bullet of bullets) {
    assert.match(
      bullet,
      /^\s*[-*] \[[^\]]+\]\(https?:\/\/\S+\)(: .+)?$/,
      `every llms.txt list item must be a markdown link with an optional note, got: ${bullet.trim()}`
    );
  }

  const h2 = headings.filter((h) => /^## /.test(h));
  assert.ok(h2.length >= 2, "llms.txt needs at least two H2 file-list sections");
  if (h2.includes("## Optional")) {
    assert.equal(h2[h2.length - 1], "## Optional", '"## Optional" must be the last section by convention');
  }
});

test("DS-3: every skill ships frontmatter that agents can match on", () => {
  const skills = listDirs("skills");
  assert.ok(skills.length >= 3, "expected at least the three guardians");

  for (const name of skills) {
    const file = `skills/${name}/SKILL.md`;
    const content = read(file);
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(match, `${file} must open with a YAML frontmatter block delimited by ---`);

    const meta = new Map(
      match[1]
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const at = line.indexOf(":");
          assert.ok(at > 0, `${file} frontmatter line is not "key: value": ${line}`);
          return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
        })
    );

    assert.equal(meta.get("name"), name, `${file} frontmatter name must match its directory`);
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, "skill names must be lowercase, hyphenated slugs");

    const description = meta.get("description") ?? "";
    assert.ok(description.length > 60, `${file} description is too short to be a discovery surface`);
    assert.ok(description.length <= 1024, `${file} description exceeds the 1024-character skill limit`);
    assert.match(
      description,
      /\b(use|when|stop|prevent|catch|freeze|before)\b/i,
      `${file} description must say what it does and when to use it`
    );
  }
});

test("DS-4: package.json exposes the metadata that makes the package findable", () => {
  const pkg = readJson("package.json");
  const slug = readSlug();

  assert.equal(pkg.license, "PolyForm-Noncommercial-1.0.0", "the SPDX id must match the shipped LICENSE");
  assert.ok(pkg.engines?.node, "declare engines.node so installers know the Node floor");
  assert.ok(pkg.homepage?.includes(slug), "homepage must point at this repository");
  assert.ok(pkg.bugs?.url?.includes(slug), "bugs.url must point at this repository's issues");
  assert.ok(/^[\w-]+$/.test(pkg.name), "the npm name must be a valid, searchable slug");
  assert.ok((pkg.keywords ?? []).length >= 10, "npm search runs on keywords: provide at least ten");
  assert.equal(
    new Set(pkg.keywords).size,
    pkg.keywords.length,
    "duplicate keywords add no discoverability"
  );

  const files = pkg.files ?? [];
  assert.ok(files.length >= 5, "use an explicit files allowlist so publishing is deterministic");
  for (const required of ["skills", "rules"]) {
    assert.ok(files.includes(required), `the files allowlist must keep shipping ${required}/`);
  }
  assert.ok(
    !files.some((entry) => entry.startsWith(".") || entry.includes("node_modules")),
    "never ship dot-directories or node_modules"
  );

  // The published suite must be complete (a consumer can run everything we ship)
  // and self-sufficient (nothing that depends on repository-only files travels).
  const suites = fs
    .readdirSync(path.join(ROOT, "test"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.js"))
    .map((entry) => `test/${entry.name}`);
  const repoOnlySuites = suites.filter((rel) => path.basename(rel).startsWith("repo."));
  const missing = suites.filter((rel) => !repoOnlySuites.includes(rel) && !files.includes(rel));
  assert.deepEqual(missing, [], `these suites ship with the package but are missing from the files allowlist: ${missing.join(", ")}`);

  // The publish boundary only exists in a repository checkout: an installed
  // package has no repository-only suites to reason about, and demanding them
  // there would fail on files that were never supposed to ship.
  if (isRepositoryCheckout()) {
    assert.ok(
      repoOnlySuites.length >= 1,
      "this repository's own suites must be named test/repo.*.test.js: the naming convention is what keeps the published surface derivable instead of hand-maintained"
    );
    const mustNotShip = [...repoOnlySuites, "baseline-config.json"].filter((rel) => files.includes(rel));
    assert.deepEqual(
      mustNotShip,
      [],
      `${mustNotShip.join(", ")} freezes this repository's own assets and must not be published: a consumer would fail on files they never received`
    );
  }
});

test("DS-5: every public URL agrees on one repository slug", () => {
  const slug = readSlug();
  const [, owner, repo] = slug.match(/^([^/]+)\/(.+)$/);

  const surfaces = ["README.md", "llms.txt", "AGENTS.md", "CONTRIBUTING.md", "CHANGELOG.md"];
  const wrong = [];
  for (const file of surfaces) {
    const content = read(file);
    for (const url of content.match(/https?:\/\/[^\s)"'`]+/g) ?? []) {
      const github = url.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/) ?? url.match(/raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)/);
      if (!github) continue;
      const found = `${github[1]}/${github[2].replace(/\.git$/, "")}`;
      if (found !== slug) wrong.push(`${file}: ${url}`);
    }
  }
  assert.deepEqual(wrong, [], `these URLs do not point at ${slug} (a renamed repository leaves dead links)`);

  assert.ok(read("README.md").includes(`${owner}/${repo}`), "the README must name the install slug");
});

test("DS-6: issue and PR templates stay structurally valid", (t) => {
  if (!isRepositoryCheckout()) {
    return t.skip("installed package: .github/ is not published, so there are no templates to validate");
  }
  const dir = ISSUE_TEMPLATES_DIR;
  const templates = fs
    .readdirSync(path.join(ROOT, dir))
    .filter((name) => name.endsWith(".yml") && name !== "config.yml");

  assert.ok(templates.length >= 1, "at least one issue form is expected");

  for (const name of templates) {
    const content = read(`${dir}/${name}`);
    assert.ok(!content.includes("\t"), `${dir}/${name} must not contain tabs (YAML)`);
    assert.match(content, /^name: \S/m, `${dir}/${name} needs a name`);
    assert.match(content, /^description: \S/m, `${dir}/${name} needs a description`);
    assert.match(content, /^body:\s*$/m, `${dir}/${name} needs a body`);

    const ids = [...content.matchAll(/^\s+id: (\S+)$/gm)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${dir}/${name} has duplicate ids: ${ids.join(", ")}`);

    const types = [...content.matchAll(/^\s+- type: (\w+)$/gm)].map((m) => m[1]);
    const allowed = new Set(["markdown", "input", "textarea", "dropdown", "checkboxes"]);
    assert.ok(types.length >= 1, `${dir}/${name} defines no form elements`);
    for (const type of types) {
      assert.ok(allowed.has(type), `${dir}/${name} uses an unsupported element type: ${type}`);
    }

    // Every element except a pure markdown block must carry a label.
    const elementCount = types.filter((t) => t !== "markdown").length;
    const labelCount = [...content.matchAll(/^\s+label: /gm)].length;
    assert.ok(labelCount >= elementCount, `${dir}/${name} has ${elementCount} elements but only ${labelCount} labels`);
  }

  const config = read(`${dir}/config.yml`);
  assert.match(config, /^blank_issues_enabled: (true|false)$/m, "config.yml must declare blank_issues_enabled");
  for (const link of config.matchAll(/^\s+- name: (.+)$/gm)) {
    assert.ok(link[1].trim().length > 0, "contact links need a name");
  }
  assert.match(config, /security\/advisories/, "route security reports to private advisories, not public issues");

  const pr = read(".github/PULL_REQUEST_TEMPLATE.md");
  assert.match(pr, /npm test/, "the PR template must require the suite to be run");
  assert.match(pr, /fail[- ]closed/i, "the PR template must ask about fail-closed behaviour");
});

test("DS-7: the README works as a landing page", () => {
  const readme = read("README.md");

  const badges = readme.match(/!\[[^\]]*\]\(https?:\/\/[^)]+\)/g) ?? [];
  assert.ok(badges.length >= 4, "a discoverable README shows badges (CI, license, runtime, compatibility)");
  assert.match(readme, /badge\.svg/, "badges must resolve to real badge endpoints");

  for (const [pattern, what] of [
    [/##\s.*(quickstart|install)/i, "an install/quickstart section"],
    [/##\s.*(license)/i, "a license section"],
    [/##\s.*(faq)/i, "an FAQ section"],
    [/AGENTS\.md/, "a pointer to AGENTS.md"],
    [/llms\.txt/, "a pointer to llms.txt"],
    [/npx skills add/, "the install command agents and users will copy"],
    [/npm test/, "how to run the suite"],
    [/node:test|Node\.js/, "the runtime requirement"],
  ]) {
    assert.match(readme, pattern, `the README is missing ${what}`);
  }

  // Anchors and relative links must resolve, or the landing page shows 404s.
  const targets = [...readme.matchAll(/\]\((?!https?:|#)([^)#\s]+)/g)].map((m) => m[1]);
  const missing = targets.filter((target) => !fs.existsSync(path.join(ROOT, target)));
  assert.deepEqual(missing, [], `the README links to paths that do not exist: ${missing.join(", ")}`);
});

test("DS-8: the public surface leaks no private data or machine paths", () => {
  const targets = [
    "README.md",
    "AGENTS.md",
    "llms.txt",
    "CLAUDE.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    ...(isRepositoryCheckout()
      ? [
          ".github/copilot-instructions.md",
          ".github/PULL_REQUEST_TEMPLATE.md",
          ...fs.readdirSync(path.join(ROOT, ISSUE_TEMPLATES_DIR)).map((n) => `${ISSUE_TEMPLATES_DIR}/${n}`),
        ]
      : []),
    ...listDirs("skills").flatMap((skill) => [`skills/${skill}/SKILL.md`, `skills/${skill}/README.md`]),
    ...fs.readdirSync(path.join(ROOT, "rules")).map((n) => `rules/${n}`),
  ];

  const patterns = [
    [/(^|[^\w])[A-Za-z]:[\\/]/, "an absolute Windows path (drive letter)"],
    [/(^|[^\w])\.\.[\\/]Users[\\/]/, "a relative reference into a user home directory"],
    [/\/(?:home|Users)\/[a-z][\w.-]*\//, "an absolute POSIX home path"],
    [/AppData|OneDrive|Desktop[\\/]/, "a machine-specific directory"],
    [/\bsk-[A-Za-z0-9]{16,}/, "an API key"],
    [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/, "a GitHub token"],
    [/\bgithub_pat_[A-Za-z0-9_]{20,}/, "a fine-grained GitHub token"],
    [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
    [/\beyJ[A-Za-z0-9_-]{20,}\./, "a JWT"],
    [/[\w.+-]+@[\w-]+\.[a-z]{2,}/i, "a published contact address (route reports through GitHub instead)"],
  ];

  const hits = [];
  for (const file of targets) {
    const content = read(file);
    content.split("\n").forEach((line, index) => {
      for (const [pattern, what] of patterns) {
        if (pattern.test(line)) hits.push(`${file}:${index + 1} contains ${what}`);
      }
    });
  }

  assert.deepEqual(hits, [], `the published surface must not expose private data:\n  ${hits.join("\n  ")}`);
});
