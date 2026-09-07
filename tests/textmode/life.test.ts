import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceLifeGeneration, seedLifeCells } from "../../src/shared/textmode/life/engine";

test("the life simulation evolves a blinker without mutating its previous frame", () => {
  const horizontal = new Uint8Array([0, 0, 0, 1, 1, 1, 0, 0, 0]);
  const original = horizontal.slice();
  const vertical = new Uint8Array(9);
  assert.equal(advanceLifeGeneration(horizontal, vertical, 3), 3);
  assert.deepEqual(vertical, new Uint8Array([0, 1, 0, 0, 1, 0, 0, 1, 0]));
  assert.deepEqual(horizontal, original);
  assert.equal(advanceLifeGeneration(vertical, horizontal, 3), 3);
  assert.deepEqual(horizontal, original);
});

test("life preserves a stable block and does not wrap neighbors across edges", () => {
  const block = new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0]);
  const next = new Uint8Array(block.length);
  assert.equal(advanceLifeGeneration(block, next, 4), 4);
  assert.deepEqual(next, block);
  const corners = new Uint8Array([1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1]);
  assert.equal(advanceLifeGeneration(corners, next, 4), 0);
  assert.ok(next.every((cell) => cell === 0));
});

test("life rejects invalid buffers and reseeds every cell in place", () => {
  const cells = new Uint8Array(9).fill(2);
  assert.throws(() => advanceLifeGeneration(cells, cells, 3), RangeError);
  assert.throws(() => advanceLifeGeneration(cells, new Uint8Array(8), 3), RangeError);
  assert.throws(() => advanceLifeGeneration(cells, new Uint8Array(9), 4), RangeError);
  assert.throws(() => seedLifeCells(cells, 0), RangeError);
  seedLifeCells(cells, 3);
  assert.ok(cells.every((cell) => cell === 0 || cell === 1));
});
