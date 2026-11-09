import test from "node:test";
import assert from "node:assert/strict";
import { recordVote, snapshot, WINDOW_MS } from "../lib/world-poll.js";

test("votes add up in the current five-minute window and start from scratch at the next", () => {
  const base = 1_700_000_000_000;
  const start = base - (base % WINDOW_MS);

  recordVote("survival", start + 1000);
  recordVote("survival", start + 2000);
  recordVote("bedwars", start + 3000);

  const current = snapshot(start + 4000);
  assert.deepEqual(current.votes, { survival: 2, bedwars: 1 });
  assert.equal(current.total, 3);
  assert.equal(current.resetAt, start + WINDOW_MS);
  assert.equal(current.secondsLeft, WINDOW_MS / 1000 - 4);

  const next = snapshot(start + WINDOW_MS + 10);
  assert.deepEqual(next.votes, { survival: 0, bedwars: 0 });
  assert.equal(next.total, 0);
});

test("unknown worlds are not counted", () => {
  assert.equal(recordVote("creative", Date.now()), null);
  assert.equal(recordVote("", Date.now()), null);
});
