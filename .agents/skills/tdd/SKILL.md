---
name: tdd
description: Test-driven development for new behavior and bug fixes. Invoke before implementing user-visible logic, API changes, business rules, and regressions. Do not write production code for non-trivial behavior before a failing test or repro exists.
---

# TDD

The test is not cleanup after coding. It is the first precise statement of the behavior you want.

Core rule: for non-trivial behavior, write the failing test before the implementation.

---

## When to use this

Use TDD for:

- new behavior
- business rules
- API or CLI behavior changes
- regression fixes after a bug is understood
- refactors where existing behavior must stay fixed

Do not force full TDD for:

- purely mechanical renames
- copy edits or docs-only changes
- one-line config tweaks with no realistic harness

If you skip TDD, say why.

---

## Step 1 - Start from behavior, not code shape

Before writing the test, define:

- what input or trigger matters
- what output or observable effect should happen
- what edge case proves the behavior is real

Good TDD starts with an externally visible behavior. Avoid writing tests around private helpers or incidental call structure unless that is the public contract.

If the interface is still vague, sketch the usage first. The test should make the API or behavior concrete.

---

## Step 2 - Write the smallest failing test

Write one test that captures the next behavior slice.

Rules:

- one behavior at a time
- keep the test small and explicit
- prefer real inputs and outputs over elaborate mocks
- name the test after the behavior, not the implementation

The test should fail for the right reason:

- missing behavior
- incorrect output
- wrong validation
- missing edge-case handling

If it passes immediately, you did not prove anything yet.

---

## Step 3 - Run the test and watch it fail

This step is mandatory.

Run the targeted test before writing production code and confirm:

- the test actually runs
- it fails
- it fails for the expected reason

If the failure is unrelated, fix the test or harness first. Green without a prior red is not TDD.

---

## Step 4 - Write the minimum code to get green

Implement only enough production code to satisfy the test.

Rules:

- no speculative abstractions
- no bundling extra features
- no broad refactors in the green step
- no "while I'm here" cleanup unless needed for the test to pass

TDD works by shortening the distance between intention and code. Minimal green is what keeps that loop tight.

---

## Step 5 - Refactor with tests protecting behavior

Once green:

- improve naming
- remove duplication
- extract helpers only when the behavior is already locked by tests
- strengthen the test if it is coupled to implementation detail

Refactor both production code and tests. Tests are code too.

Good test qualities:

- deterministic
- focused on one behavior
- easy to read in one pass
- resistant to harmless internal refactors

---

## Step 6 - Grow the behavior incrementally

Repeat the loop for the next slice:

1. choose the next behavior or edge case
2. write a failing test
3. get it green with minimal code
4. refactor

Prefer several small red-green-refactor loops over one giant test file or one giant implementation pass.

---

## Bug-fix mode

For bugs:

1. reproduce and isolate the issue first
2. capture it as a failing regression test or durable repro
3. make that repro pass
4. run adjacent checks for confidence

If you do not yet understand the bug, switch to `systematic-debugging` before forcing TDD.

---

## Test design guardrails

Prefer:

- behavior over implementation detail
- simple fixtures over deep mock trees
- one clear assertion cluster over many unrelated assertions
- project-native test helpers and conventions over custom mini frameworks

Avoid:

- mocking the thing you are trying to prove
- asserting internal method calls when output would be enough
- giant test setup blocks that hide the intent
- writing five tests before running the first one

---

## What this bundle is not

- Not a replacement for `quality-gates` - TDD gets you to confidence during implementation; quality-gates verifies the final claim before completion
- Not a replacement for `systematic-debugging` - for bugs you still need root cause and a real repro before the regression test is meaningful
- Not a replacement for `planning-first` or `spec-driven` - TDD shapes implementation, not product scope

This bundle exists to prevent a common failure mode: code gets written first, and tests arrive later as justification.
