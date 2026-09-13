import assert from "node:assert/strict";
import { test } from "node:test";
import { type AlgorithmFrame, createAlgorithm, renderBars } from "../../src/shared/textmode/algorithm-art/engine";
import { algorithmKinds, selectAlgorithm } from "../../src/shared/textmode/algorithm-art/model";

test("article assignment is stable, independent of pool order, and only changes to added candidates", () => {
  const pool = ["life", "maze"] as const;
  const selected = new Set<string>();
  for (let index = 0; index < 200; index += 1) {
    const key = `/volume/1/article-${index}/`;
    const before = selectAlgorithm(key, pool);
    assert.equal(selectAlgorithm(key, [...pool].reverse()), before);
    const after = selectAlgorithm(key, algorithmKinds);
    assert.ok(after === before || !pool.some((kind) => kind === after));
    selected.add(after);
  }
  assert.deepEqual(selected, new Set(algorithmKinds));
  assert.equal(selectAlgorithm("any article", ["maze"]), "maze");
  assert.throws(() => selectAlgorithm("any article", []), RangeError);
});

function rectangles(path: string) {
  return [...path.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4])
  }));
}

function visibleShapes(frame: AlgorithmFrame, progress = 0) {
  const field = rectangles(frame.ink + frame.accent + (frame.trail ?? ""));
  const moving = (frame.motion ?? []).map((shape) => ({
    ...shape,
    x: shape.fromX + (shape.x - shape.fromX) * progress,
    y: shape.fromY + (shape.y - shape.fromY) * progress
  }));
  return [...field, ...moving]
    .map((shape) => ({
      x: Math.max(0, shape.x),
      y: Math.max(0, shape.y),
      width: Math.min(184, shape.x + shape.width) - Math.max(0, shape.x),
      height: Math.min(210, shape.y + shape.height) - Math.max(0, shape.y)
    }))
    .filter((shape) => shape.width > 0 && shape.height > 0);
}

test("new algorithms stay bounded and use all four edges throughout multiple cycles", () => {
  for (const kind of ["maze", "sort"] as const) {
    const first = createAlgorithm(kind, "example");
    const second = createAlgorithm(kind, "example");
    const distinct = new Set<string>();
    for (let tick = 0; tick < 450; tick += 1) {
      const frame = first.next();
      assert.deepEqual(frame, second.next(), `${kind}: static and browser playback agree`);
      distinct.add(frame.ink);
      const shapes = visibleShapes(frame, 1);
      assert.ok(shapes.length > 0, `${kind}: never presents an empty frame`);
      for (const { x, y, width, height } of shapes) {
        assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 184 && y + height <= 210);
      }
      assert.equal(Math.min(...shapes.map(({ x }) => x)), 0, `${kind}: no left padding`);
      assert.equal(Math.min(...shapes.map(({ y }) => y)), 0, `${kind}: no top padding`);
      assert.equal(Math.max(...shapes.map(({ x, width }) => x + width)), 184, `${kind}: no right padding`);
      assert.equal(Math.max(...shapes.map(({ y, height }) => y + height)), 210, `${kind}: no bottom padding`);
    }
    assert.ok(distinct.size > 30, `${kind}: keeps evolving`);
  }
});

test("sorting preserves all bars, reaches ascending order, and starts a fresh permutation", () => {
  const animation = createAlgorithm("sort", "example");
  const ascending = Array.from({ length: 14 }, (_, index) => (index + 1) * 15);
  let sorted = false;
  let restarted = false;
  for (let tick = 0; tick < 250; tick += 1) {
    const frame = animation.next();
    const values = rectangles(frame.ink + frame.accent)
      .sort((a, b) => a.x - b.x)
      .map(({ height }) => height);
    assert.deepEqual(
      [...values].sort((a, b) => a - b),
      ascending
    );
    const ordered = values.every((value, index) => value === ascending[index]);
    if (sorted && !ordered) restarted = true;
    sorted ||= ordered;
  }
  assert.ok(sorted && restarted);
});

test("sorting keeps identical gaps and fills the available width at different pixel densities", () => {
  const values = Array.from({ length: 14 }, (_, index) => 14 - index);
  for (const width of [90, 96, 168, 192, 288, 336, 576]) {
    for (const gap of [1, 2, 3]) {
      const frame = renderBars(values, 4, width, 224, gap);
      const bars = rectangles(frame.ink + frame.accent).sort((a, b) => a.x - b.x);
      assert.equal(bars.length, values.length);
      assert.equal(bars[0]?.x, 0);
      assert.equal((bars.at(-1)?.x ?? 0) + (bars.at(-1)?.width ?? 0), width);
      assert.ok(Math.max(...bars.map((bar) => bar.width)) - Math.min(...bars.map((bar) => bar.width)) <= 1);
      for (let index = 1; index < bars.length; index += 1) {
        assert.equal((bars[index]?.x ?? 0) - ((bars[index - 1]?.x ?? 0) + (bars[index - 1]?.width ?? 0)), gap);
      }
    }
  }
});

test("a completed maze has one connected, acyclic passage network", () => {
  const animation = createAlgorithm("maze", "example");
  let frame = animation.next();
  for (let tick = 0; frame.motion?.length && tick < 400; tick += 1) frame = animation.next();
  assert.equal(frame.motion?.length, 0, "The maze completes within one traversal");
  const walls = rectangles(frame.ink);
  const adjacency = Array.from({ length: 195 }, () => [] as number[]);
  let openings = 0;
  for (let row = 0; row < 15; row += 1) {
    for (let column = 0; column < 13; column += 1) {
      const cell = row * 13 + column;
      for (const [neighbor, x, y] of [
        ...(column < 12 ? [[cell + 1, Math.round(((column + 1) * 184) / 13), row * 14 + 7]] : []),
        ...(row < 14 ? [[cell + 13, Math.round((column * 184) / 13) + 7, (row + 1) * 14]] : [])
      ]) {
        if (neighbor === undefined || x === undefined || y === undefined) throw new Error("Missing maze edge");
        if (walls.some((wall) => x >= wall.x && x < wall.x + wall.width && y >= wall.y && y < wall.y + wall.height))
          continue;
        adjacency[cell]?.push(neighbor);
        adjacency[neighbor]?.push(cell);
        openings += 1;
      }
    }
  }
  const seen = new Set<number>();
  const stack = [0];
  while (stack.length) {
    const cell = stack.pop() ?? 0;
    if (seen.has(cell)) continue;
    seen.add(cell);
    stack.push(...(adjacency[cell] ?? []));
  }
  assert.equal(seen.size, 195);
  assert.equal(openings, 194);
});

test("the maze cursor follows open neighboring passages during exploration and backtracking", () => {
  const animation = createAlgorithm("maze", "example");
  for (let tick = 0; tick < 800; tick += 1) {
    const frame = animation.next();
    const walls = rectangles(frame.ink);
    for (const cursor of frame.motion ?? []) {
      const distance = Math.abs(cursor.x - cursor.fromX) + Math.abs(cursor.y - cursor.fromY);
      assert.ok(distance <= 15, "No cursor teleport across several cells");
      assert.ok(cursor.x === cursor.fromX || cursor.y === cursor.fromY, "Follow one corridor");
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const x = cursor.fromX + (cursor.x - cursor.fromX) * progress + cursor.width / 2;
        const y = cursor.fromY + (cursor.y - cursor.fromY) * progress + cursor.height / 2;
        assert.equal(
          walls.some((wall) => x >= wall.x && x < wall.x + wall.width && y >= wall.y && y < wall.y + wall.height),
          false
        );
      }
    }
  }
});

test("maze renewal rebuilds one row at a time instead of flashing a whole new grid", () => {
  const animation = createAlgorithm("maze", "example");
  let previous = new Set<string>();
  let renewals = 0;
  for (let tick = 0; tick < 450; tick += 1) {
    const frame = animation.next();
    const current = new Set(rectangles(frame.ink).map((wall) => JSON.stringify(wall)));
    if (previous.size) {
      const added = [...current].filter((wall) => !previous.has(wall));
      assert.ok(added.length <= 26, "At most one row is restored per step");
      if (added.length) renewals += 1;
    }
    previous = current;
  }
  assert.ok(renewals > 1);
});
