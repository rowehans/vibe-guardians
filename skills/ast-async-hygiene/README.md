# 🧹 AST Async Hygiene Guardian

A lightweight AST analyzer powered by Acorn that catches forgotten `await` statements on critical operations and flags empty `catch` blocks before they cause silent data loss.

## The Problem

When coding with AI assistants, the #1 cause of serverless outages and flaky tests is:
- AI forgetting to put `await` before a database save or fetch request.
- AI wrapping failing code in `catch (e) {}` to make a test artificially pass by suppressing the error.

## The Solution

`ast-async-hygiene` parses your code into an Abstract Syntax Tree (AST) using Acorn and checks every statement:
- Flags unawaited database mutations in expression statements.
- Flags silent empty catch blocks.

## Usage

Run directly with Node.js:
```bash
node --test test/code-hygiene.test.js
```
