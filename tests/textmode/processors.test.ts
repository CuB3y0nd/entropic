import assert from "node:assert/strict";
import { test } from "node:test";
import { createAlgorithm } from "../../src/shared/textmode/algorithm-art/engine";
import {
  applyBitOperation,
  createByteMachine,
  createReorderQueue
} from "../../src/shared/textmode/algorithm-art/processors";

test("byte operations rotate across the high bit, preserve eight bits, and shift in zeroes", () => {
  assert.equal(applyBitOperation(0xa5, "XOR", 0x5a), 0xff);
  assert.equal(applyBitOperation(0x81, "ROL", 1), 0x03);
  assert.equal(applyBitOperation(0x81, "ROL", 7), 0xc0);
  assert.equal(applyBitOperation(0x81, "ROL", 0), 0x81);
  assert.equal(applyBitOperation(0xe5, "SHR", 2), 0x39);
  assert.equal(applyBitOperation(1, "SHR", 1), 0);
});

test("the assembly loop updates registers, takes branches, then copies its completed result", () => {
  const machine = createByteMachine(() => 0);
  const execution = [0, 1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 7, 8];
  const sums = [];
  for (const pc of execution) {
    const state = machine.next();
    assert.equal(state.executed, pc);
    assert.ok(state.registers.every((value) => value >= 0 && value <= 255));
    if (pc === 4) sums.push(state.registers[2]);
    if (pc === 6) assert.equal(state.nextPc, state.zero ? 7 : 2);
    if (pc === 8) {
      assert.equal(state.nextPc, 0);
      assert.deepEqual(state.registers, [14, 0, 22, 22]);
    }
  }
  assert.deepEqual(sums, [2, 8, 22]);
  assert.equal(machine.next().executed, 0);
});

test("out-of-order execution observes dependencies and retires only a contiguous prefix", () => {
  const queue = createReorderQueue(() => 0);
  let outOfOrder = false;
  let completed = false;
  let restarted = false;
  for (let tick = 0; tick < 120; tick += 1) {
    const state = queue.next();
    assert.ok(state.entries.filter((entry) => entry.status === "running").length <= 2);
    assert.equal(state.entries.length, 6);
    for (const [index, entry] of state.entries.entries()) {
      assert.equal(entry.status === "retired", index < state.retired);
      if (["running", "ready", "retired"].includes(entry.status)) {
        for (const dependency of entry.dependencies) {
          assert.ok(["ready", "retired"].includes(state.entries[dependency]?.status ?? ""));
        }
      }
    }
    outOfOrder ||= state.entries[1]?.status === "ready" && state.entries[0]?.status === "running";
    if (completed && state.tick === 0) restarted = true;
    completed ||= state.retired === 6;
  }
  assert.ok(outOfOrder && completed && restarted);
});

test("processor illustrations stay deterministic and use the full native character area", () => {
  for (const kind of ["bits", "asm", "reorder"] as const) {
    const a = createAlgorithm(kind, "article");
    const b = createAlgorithm(kind, "article");
    const distinct = new Set<string>();
    for (let step = 0; step < 250; step += 1) {
      const frame = a.next();
      assert.deepEqual(frame, b.next(), "Static HTML and browser start with the same state");
      const labels = frame.labels?.filter((label) => label.text) ?? [];
      distinct.add(JSON.stringify(labels));
      assert.ok(labels.length >= 15);
      assert.equal(Math.min(...labels.map((label) => label.column)), 0);
      assert.equal(Math.min(...labels.map((label) => label.row)), 0);
      assert.equal(Math.max(...labels.map((label) => label.row)), 14);
      assert.equal(Math.max(...labels.map((label) => label.column + label.text.length)), 23);
      for (const label of labels) {
        assert.ok(label.column >= 0 && label.row >= 0 && label.row <= 14);
        assert.ok(label.column + label.text.length <= 23, `${kind}: text stays inside the frame`);
        assert.doesNotMatch(label.text, /[\n\r\t]/);
      }
    }
    assert.ok(distinct.size > 30, `${kind}: keeps executing`);
  }
});
