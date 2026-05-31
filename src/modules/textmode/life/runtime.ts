import { lifeFrameHeight, lifeInnerHeight, lifeInnerWidth } from "./art";

type LifeInstance = {
  root: HTMLElement;
  lines: HTMLElement[];
  pixels: HTMLElement[];
  cells: boolean[][];
};

const frameMs = 220;
const gameWidth: number = 15;
const gameHeight: number = 17;
const layoutReadyTimeoutMs = 1200;
let installed = false;
let installStarted = false;
let intervalId = 0;

export function initLifeArt(): void {
  if (installed || installStarted || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  installStarted = true;
  void installLifeArt().catch((error: unknown) => {
    installStarted = false;
    console.error(error);
  });
}

async function installLifeArt(): Promise<void> {
  await waitForTextmodeLayout();

  const instances = [...document.querySelectorAll<HTMLElement>("[data-life-root]")]
    .map((root) => {
      const lines = [...root.querySelectorAll<HTMLElement>("[data-life-line]")].sort(
        (left, right) => Number(left.dataset.row) - Number(right.dataset.row)
      );

      if (lines.length !== lifeFrameHeight) {
        return undefined;
      }

      const pixels = installGrid(root, lines[0]);

      return { root, lines, pixels, cells: seedCells() };
    })
    .filter((instance): instance is LifeInstance => instance !== undefined);

  if (instances.length === 0) {
    installStarted = false;
    return;
  }

  installed = true;

  for (const instance of instances) {
    render(instance);
  }

  const tick = () => {
    for (const instance of instances) {
      instance.cells = nextGeneration(instance.cells);
      if (population(instance.cells) < 8) {
        instance.cells = seedCells();
      }
      render(instance);
    }
  };
  const start = () => {
    if (intervalId === 0) {
      intervalId = window.setInterval(tick, frameMs);
    }
  };
  const stop = () => {
    if (intervalId !== 0) {
      window.clearInterval(intervalId);
      intervalId = 0;
    }
  };
  const positionAll = createScheduledPositioner(instances);

  start();
  window.addEventListener("resize", positionAll, { passive: true });
  window.addEventListener("orientationchange", positionAll, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      positionAll();
      start();
      return;
    }

    stop();
  });
}

async function waitForTextmodeLayout(): Promise<void> {
  if ("fonts" in document) {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => window.setTimeout(resolve, layoutReadyTimeoutMs))
    ]);
  }

  await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
}

function seedCells(): boolean[][] {
  return Array.from({ length: gameHeight }, (_, row) =>
    Array.from({ length: gameWidth }, (_, column) => {
      const centerBias = Math.abs(column - gameWidth / 2) + Math.abs(row - gameHeight / 2);
      const isEdge = row === 0 || row === gameHeight - 1 || column === 0 || column === gameWidth - 1;
      const threshold = isEdge ? 0.32 : centerBias < 9 ? 0.38 : 0.22;
      return Math.random() < threshold;
    })
  );
}

function nextGeneration(cells: boolean[][]): boolean[][] {
  return cells.map((row, y) =>
    row.map((cell, x) => {
      const neighbors = countNeighbors(cells, x, y);
      return cell ? neighbors === 2 || neighbors === 3 : neighbors === 3;
    })
  );
}

function countNeighbors(cells: boolean[][], x: number, y: number): number {
  let count = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      if (cells[y + dy]?.[x + dx]) {
        count += 1;
      }
    }
  }

  return count;
}

function population(cells: boolean[][]): number {
  return cells.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

function render(instance: LifeInstance): void {
  for (const [index, pixel] of instance.pixels.entries()) {
    const row = Math.floor(index / gameWidth);
    const column = index % gameWidth;
    pixel.classList.toggle("is-alive", Boolean(instance.cells[row]?.[column]));
  }
}

function createScheduledPositioner(instances: LifeInstance[]): () => void {
  let animationFrame = 0;

  return () => {
    if (animationFrame !== 0) {
      return;
    }

    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0;

      for (const instance of instances) {
        positionGrid(instance.root, instance.lines[0]);
      }
    });
  };
}

function installGrid(root: HTMLElement, firstLine: HTMLElement): HTMLElement[] {
  const grid = document.createElement("span");
  const pixels = Array.from({ length: gameWidth * gameHeight }, () => {
    const pixel = document.createElement("span");
    pixel.className = "life-pixel";
    grid.append(pixel);
    return pixel;
  });

  grid.className = "life-grid";
  grid.style.setProperty("--life-grid-width", String(gameWidth));
  grid.style.setProperty("--life-grid-height", String(gameHeight));
  root.append(grid);
  positionGrid(root, firstLine);

  return pixels;
}

function positionGrid(root: HTMLElement, firstLine: HTMLElement | undefined): void {
  const grid = root.querySelector<HTMLElement>(".life-grid");

  if (!grid || !firstLine) {
    return;
  }

  const styles = getComputedStyle(root);
  const textCell = parseCssPx(styles.getPropertyValue("--text-cell")) || 8;
  const textSize = parseCssPx(styles.getPropertyValue("--text-size")) || 14;
  const framePosition = inlinePosition(root, firstLine);
  const innerWidth = lifeInnerWidth * textCell;
  const innerHeight = lifeInnerHeight * textSize;
  const pixelSize = squarePixelSize(innerWidth, innerHeight);
  const gridWidth = gameWidth * pixelSize;
  const gridHeight = gameHeight * pixelSize;
  const innerLeft = framePosition.left + textCell;
  const innerTop = framePosition.top + textSize;
  const innerRight = innerLeft + innerWidth;
  const innerBottom = innerTop + innerHeight;
  const left = innerLeft + (innerWidth - gridWidth) / 2;
  const top = innerTop + (innerHeight - gridHeight) / 2;
  const clipTop = Math.max(0, innerTop - top);
  const clipRight = Math.max(0, left + gridWidth - innerRight);
  const clipBottom = Math.max(0, top + gridHeight - innerBottom);
  const clipLeft = Math.max(0, innerLeft - left);

  grid.style.left = `${left}px`;
  grid.style.top = `${top}px`;
  grid.style.setProperty("--life-grid-size", `${pixelSize}px`);
  grid.style.clipPath = `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
}

function squarePixelSize(innerWidth: number, innerHeight: number): number {
  const fillSize = Math.max(innerWidth / gameWidth, innerHeight / gameHeight);
  const equalBleedSize = gameHeight === gameWidth ? fillSize : (innerHeight - innerWidth) / (gameHeight - gameWidth);

  return Number.isFinite(equalBleedSize) && equalBleedSize >= fillSize ? equalBleedSize : fillSize;
}

function inlinePosition(root: HTMLElement, element: HTMLElement): { left: number; top: number } {
  const rootRect = root.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const zoomScale = effectiveZoomScale(root);

  return {
    left: (elementRect.left - rootRect.left) / zoomScale,
    top: (elementRect.top - rootRect.top) / zoomScale
  };
}

function effectiveZoomScale(element: HTMLElement): number {
  const cssZoom = ancestorZoomScale(element);

  return cssZoom !== 1 ? cssZoom : configuredTextmodeZoomScale(element);
}

function ancestorZoomScale(element: HTMLElement): number {
  let scale = 1;
  let cursor: HTMLElement | null = element;

  while (cursor) {
    scale *= parseZoom(getComputedStyle(cursor).zoom);
    cursor = cursor.parentElement;
  }

  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function configuredTextmodeZoomScale(element: HTMLElement): number {
  const wrapper = element.closest<HTMLElement>(".textmode-wrap, .home-shell");

  if (!wrapper) {
    return 1;
  }

  const styles = getComputedStyle(wrapper);
  const mobileScale = parsePositiveNumber(styles.getPropertyValue("--mobile-scale")) || 1;
  const fitScale = parsePositiveNumber(styles.getPropertyValue("--fit-scale")) || 1;

  return Math.min(mobileScale, fitScale);
}

function parseZoom(input: string): number {
  if (input.endsWith("%")) {
    const percentage = Number.parseFloat(input);
    return Number.isFinite(percentage) && percentage > 0 ? percentage / 100 : 1;
  }

  const value = Number.parseFloat(input);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function parsePositiveNumber(input: string): number {
  const value = Number.parseFloat(input);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function parseCssPx(input: string): number {
  const value = Number.parseFloat(input);
  return Number.isFinite(value) ? value : 0;
}
