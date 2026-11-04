import { test } from "node:test";
import assert from "node:assert/strict";
import { runCode } from "../lib/sandbox.js";
import { getQuest, quests, publicQuests, tracks } from "../lib/quests.js";

test("every quest has complete, unique content", () => {
  const ids = new Set();
  for (const quest of quests) {
    assert.ok(!ids.has(quest.id), `duplicate id ${quest.id}`);
    ids.add(quest.id);
    for (const field of ["title", "emoji", "story", "concept", "prompt", "starter", "solution", "level"]) {
      assert.ok(String(quest[field] || "").trim().length > 0, `${quest.id} missing ${field}`);
    }
    assert.ok(tracks.some((track) => track.id === quest.track), `${quest.id} has unknown track`);
    assert.ok(quest.hints.length >= 1, `${quest.id} needs a hint`);
    assert.ok(quest.tests.length >= 1, `${quest.id} needs a test`);
    assert.ok(quest.xp > 0, `${quest.id} needs xp`);
  }
});

test("each quest solution passes all of its own checks", () => {
  for (const quest of quests) {
    const result = runCode(quest.solution, quest.tests);
    assert.equal(result.ok, true, `${quest.id}: ${result.error}`);
    const failed = result.results.filter((entry) => !entry.pass);
    assert.equal(failed.length, 0, `${quest.id} failed: ${failed.map((f) => f.description).join(", ")}`);
    assert.equal(result.passed, true, `${quest.id} should pass`);
  }
});

test("starter code does not already pass", () => {
  for (const quest of quests) {
    const result = runCode(quest.starter, quest.tests);
    assert.equal(result.passed, false, `${quest.id} starter already passes`);
  }
});

test("console output is captured and values are inspected", () => {
  const result = runCode('console.log("hi", 2 + 2, [1, 2]);', []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.logs, ["hi 4 [ 1, 2 ]"]);
  assert.equal(result.passed, false, "playground runs are never 'passed'");
});

test("syntax errors are reported nicely", () => {
  const result = runCode("const x = ;", []);
  assert.equal(result.ok, false);
  assert.match(result.error, /typo/i);
});

test("thrown errors are reported without crashing", () => {
  const result = runCode("throw new Error('boom');", []);
  assert.equal(result.ok, false);
  assert.match(result.error, /boom/);
});

test("infinite loops time out instead of hanging", () => {
  const started = Date.now();
  const result = runCode("while (true) {}", []);
  assert.equal(result.ok, false);
  assert.match(result.error, /too long/i);
  assert.ok(Date.now() - started < 6000, "should stop quickly");
});

test("eval and Function are blocked inside the sandbox", () => {
  const result = runCode("eval('1 + 1');", []);
  assert.equal(result.ok, false);
  const fn = runCode("new Function('return 1')();", []);
  assert.equal(fn.ok, false);
});

test("globals like process are not available", () => {
  const result = runCode("console.log(typeof process);", []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.logs, ["undefined"]);
});

test("empty code and oversized code are rejected", () => {
  assert.equal(runCode("   ", []).ok, false);
  assert.equal(runCode("let a = 1;".repeat(4000), []).ok, false);
});

test("public quests hide the checks but share the requirements", () => {
  for (const quest of publicQuests) {
    assert.equal(quest.checks, undefined);
    assert.equal(quest.tests, undefined);
    assert.equal(quest.testList.length, quest.testCount);
    assert.ok(getQuest(quest.id));
  }
});
