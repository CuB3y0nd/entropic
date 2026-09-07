export const lifeColumnCount = 15;
export const lifeRowCount = 17;

/** Fill an existing row-major grid. Values are 0 (dead) or 1 (alive). */
export function seedLifeCells(cells: Uint8Array, columnCount: number): void {
  validateGrid(cells, columnCount);
  const rowCount = cells.length / columnCount;

  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      const distanceFromCenter = Math.abs(column - columnCount / 2) + Math.abs(row - rowCount / 2);
      const isEdge = row === 0 || row === rowCount - 1 || column === 0 || column === columnCount - 1;
      const birthProbability = isEdge ? 0.32 : distanceFromCenter < 9 ? 0.38 : 0.22;
      cells[row * columnCount + column] = Number(Math.random() < birthProbability);
    }
  }
}

/** Write one finite-board generation to a separate buffer and return its population. */
export function advanceLifeGeneration(current: Uint8Array, next: Uint8Array, columnCount: number): number {
  validateGrid(current, columnCount);
  if (current.length !== next.length || current.buffer === next.buffer) {
    throw new RangeError("Life generations require distinct, equally sized buffers");
  }

  const rowCount = current.length / columnCount;
  let livingCellCount = 0;

  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      let livingNeighborCount = 0;
      for (let neighborRow = Math.max(0, row - 1); neighborRow <= Math.min(rowCount - 1, row + 1); neighborRow += 1) {
        for (
          let neighborColumn = Math.max(0, column - 1);
          neighborColumn <= Math.min(columnCount - 1, column + 1);
          neighborColumn += 1
        ) {
          if (neighborRow !== row || neighborColumn !== column) {
            livingNeighborCount += current[neighborRow * columnCount + neighborColumn] ?? 0;
          }
        }
      }

      const cellIndex = row * columnCount + column;
      const alive = livingNeighborCount === 3 || (current[cellIndex] === 1 && livingNeighborCount === 2);
      next[cellIndex] = Number(alive);
      livingCellCount += Number(alive);
    }
  }

  return livingCellCount;
}

function validateGrid(cells: Uint8Array, columnCount: number): void {
  if (!Number.isInteger(columnCount) || columnCount <= 0 || cells.length === 0 || cells.length % columnCount !== 0) {
    throw new RangeError("Life grids require a positive column count and complete rows");
  }
}
