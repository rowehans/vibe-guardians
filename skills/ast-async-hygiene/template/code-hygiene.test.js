/**
 * code-hygiene.test.js — AST Static Analyzer for Async Hygiene & Error Safety
 * 
 * Detects:
 * 1. Floating Promises: Async database/network operations missing 'await' or 'return'.
 * 2. Silent Catches: Empty catch blocks that swallow runtime errors.
 * 
 * Runs with Node.js native test runner and Acorn AST parser:
 * node --test test/code-hygiene.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

const ASYNC_CALL_PATTERNS = [
  "fetch",
  "save",
  "update",
  "delete",
  "encrypt",
  "insert",
  "query"
];

export function inspectFile(filePath, code) {
  const issues = [];
  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true
    });
  } catch (err) {
    // If not valid ESM, try as script
    try {
      ast = acorn.parse(code, {
        ecmaVersion: "latest",
        sourceType: "script",
        locations: true
      });
    } catch {
      return issues; // Non-parseable or binary file
    }
  }

  walk.simple(ast, {
    // 1. Check for empty catch blocks
    CatchClause(node) {
      if (node.body && node.body.body && node.body.body.length === 0) {
        issues.push({
          type: "SILENT_CATCH",
          line: node.loc.start.line,
          message: "Empty catch block found. Errors must be logged or handled."
        });
      }
    },

    // 2. Check for floating async operations in ExpressionStatements
    ExpressionStatement(node) {
      if (node.expression.type === "CallExpression") {
        const callee = node.expression.callee;
        let callName = "";
        if (callee.type === "Identifier") {
          callName = callee.name;
        } else if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
          callName = callee.property.name;
        }

        const isSuspectAsync = ASYNC_CALL_PATTERNS.some(p =>
          callName.toLowerCase().includes(p)
        );

        if (isSuspectAsync) {
          issues.push({
            type: "FLOATING_PROMISE",
            line: node.loc.start.line,
            message: `Suspect async call '${callName}' is unawaited in ExpressionStatement. Missing 'await' or 'return'?`
          });
        }
      }
    }
  });

  return issues;
}

test("AST-1: Sample code with silent catch is flagged", () => {
  const badCode = `
    async function test() {
      try {
        doSomething();
      } catch (err) {}
    }
  `;
  const issues = inspectFile("test.js", badCode);
  const catches = issues.filter(i => i.type === "SILENT_CATCH");
  assert.equal(catches.length, 1, "Should flag the empty catch block");
});

test("AST-2: Unawaited database/fetch mutation is flagged as floating promise", () => {
  const badCode = `
    async function syncData() {
      fetch("/api/save"); // Missing await!
    }
  `;
  const issues = inspectFile("test.js", badCode);
  const floating = issues.filter(i => i.type === "FLOATING_PROMISE");
  assert.equal(floating.length, 1, "Should flag unawaited fetch call");
});

test("AST-3: Properly awaited calls pass cleanly", () => {
  const goodCode = `
    async function syncData() {
      await fetch("/api/save");
      try {
        validate();
      } catch (err) {
        console.error(err);
      }
    }
  `;
  const issues = inspectFile("test.js", goodCode);
  assert.equal(issues.length, 0, "Proper code should have 0 issues");
});
