import type { Algorithm, MovingRect, Random } from "./frame";
import { type AlgorithmKind, hashSeed } from "./model";
import { assembly, bits, reorder } from "./processors";

export type { AlgorithmFrame } from "./frame";

/** SVG geometry and native character labels, shared by static HTML and browser playback. */
export function createAlgorithm(kind: Exclude<AlgorithmKind, "life">, key: string): Algorithm {
  let state = hashSeed(`${key}\0${kind}`);
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  switch (kind) {
    case "maze":
      return maze(random);
    case "sort":
      return sort(random);
    case "bits":
      return bits(random);
    case "asm":
      return assembly(random);
    case "reorder":
      return reorder(random);
  }
}

function rect(x: number, y: number, width: number, height = width): string {
  return `M${x} ${y}h${width}v${height}h-${width}z`;
}

/** Distribute leftover pixels among bar widths, keeping every gap exactly the same. */
export function renderBars(values: readonly number[], active: number, width = 184, height = 210, gap = 2) {
  const available = width - gap * (values.length - 1);
  let ink = "";
  let accent = "";
  for (const [index, value] of values.entries()) {
    const left = Math.round((index * available) / values.length) + index * gap;
    const right = Math.round(((index + 1) * available) / values.length) + index * gap;
    const barHeight = Math.round((value * height) / values.length);
    const bar = rect(left, height - barHeight, right - left, barHeight);
    if (index === active) accent += bar;
    else ink += bar;
  }
  return { ink, accent };
}

function maze(random: Random): Algorithm {
  const columns = 13;
  const rows = 15;
  const visited = new Uint8Array(columns * rows);
  // Each cell owns its east and south walls. Carving removes the shared wall.
  const walls = new Uint8Array(visited.length);
  let stack: number[] = [];
  let hold = 0;
  let renewRow = -1;
  let history: number[] = [];
  const x = (column: number) => Math.round((column * 184) / columns);
  const y = (row: number) => row * 14;
  const start = () => {
    visited.fill(0);
    const cell = Math.floor(random() * visited.length);
    visited[cell] = 1;
    stack = [cell];
    history = [cell];
  };
  const carve = () => {
    const cell = stack.at(-1);
    if (cell === undefined) return;
    const column = cell % columns;
    const neighbors = [
      ...(column > 0 ? [cell - 1] : []),
      ...(column < columns - 1 ? [cell + 1] : []),
      ...(cell >= columns ? [cell - columns] : []),
      ...(cell < columns * (rows - 1) ? [cell + columns] : [])
    ].filter((neighbor) => !visited[neighbor]);
    if (neighbors.length) {
      const next = neighbors[Math.floor(random() * neighbors.length)] ?? cell;
      const owner = Math.min(cell, next);
      walls[owner] = (walls[owner] ?? 0) & ~(Math.abs(next - cell) === 1 ? 1 : 2);
      visited[next] = 1;
      stack.push(next);
    } else {
      // Backtrack one passage at a time; never teleport across the maze.
      stack.pop();
    }
    const next = stack.at(-1);
    if (next !== undefined) history = [...history.slice(-3), next];
  };
  walls.fill(3);
  start();
  for (let step = 0; step < 60; step += 1) carve();
  return {
    intervalMs: 120,
    next() {
      const previous = stack.at(-1);
      if (hold > 0) {
        hold -= 1;
        if (!hold) renewRow = 0;
      } else if (renewRow >= 0) {
        // Rebuild a row at a time instead of flashing a fresh grid across the whole frame.
        walls.fill(3, renewRow * columns, (renewRow + 1) * columns);
        renewRow += 1;
        if (renewRow === rows) {
          renewRow = -1;
          start();
        }
      } else {
        carve();
        if (!stack.length) {
          hold = 18;
          history = [];
        }
      }
      let ink = "";
      for (const [cell, wall] of walls.entries()) {
        const column = cell % columns;
        const row = Math.floor(cell / columns);
        if (wall & 1 && column < columns - 1) ink += rect(x(column + 1) - 1, y(row), 2, 14);
        if (wall & 2 && row < rows - 1) ink += rect(x(column), y(row + 1) - 1, x(column + 1) - x(column), 2);
      }
      const cursor = stack.at(-1);
      const motion: MovingRect[] = [];
      let trail = "";
      if (cursor !== undefined) {
        const from = previous ?? cursor;
        motion.push({
          fromX: x(from % columns) + 5,
          fromY: y(Math.floor(from / columns)) + 5,
          x: x(cursor % columns) + 5,
          y: y(Math.floor(cursor / columns)) + 5,
          width: 4,
          height: 4,
          accent: true
        });
        // Only the recent footsteps are visible, keeping the maze itself readable.
        for (let index = 1; index < history.length; index += 1) {
          const a = history[index - 1] ?? cursor;
          const b = history[index] ?? cursor;
          const ax = x(a % columns) + 6;
          const ay = y(Math.floor(a / columns)) + 6;
          const bx = x(b % columns) + 6;
          const by = y(Math.floor(b / columns)) + 6;
          trail += rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax) + 2, Math.abs(by - ay) + 2);
        }
      }
      return {
        ink,
        accent: "",
        trail,
        motion
      };
    }
  };
}

function sort(random: Random): Algorithm {
  const bars = Array.from({ length: 14 }, (_, index) => index + 1);
  let sorted = 1;
  let cursor = 1;
  let hold = 0;
  const shuffle = () => {
    for (let index = bars.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      const value = bars[index] ?? 1;
      bars[index] = bars[other] ?? 1;
      bars[other] = value;
    }
    sorted = 1;
    cursor = 1;
  };
  shuffle();
  return {
    intervalMs: 180,
    next() {
      if (hold > 0) {
        hold -= 1;
        if (!hold) shuffle();
      } else if (cursor > 0 && (bars[cursor - 1] ?? 0) > (bars[cursor] ?? 0)) {
        const value = bars[cursor] ?? 1;
        bars[cursor] = bars[cursor - 1] ?? 1;
        bars[cursor - 1] = value;
        cursor -= 1;
      } else {
        sorted += 1;
        cursor = sorted;
        if (sorted === bars.length) hold = 14;
      }
      const active = hold ? -1 : cursor;
      return { ...renderBars(bars, active), bars: { values: [...bars], active } };
    }
  };
}
