import { observeAnimationActivity } from "@/shared/browser/animation-activity";
import { lifeFrameHeight, lifeInnerHeight, lifeInnerWidth } from "./art";
import { advanceLifeGeneration, lifeColumnCount, lifeRowCount, seedLifeCells } from "./engine";

const generationIntervalMs = 220;
let installationStarted = false;

export function initLifeArt(): void {
  if (installationStarted) return;
  installationStarted = true;
  void installLifeArt().catch((error: unknown) => {
    installationStarted = false;
    console.error(error);
  });
}

async function installLifeArt(): Promise<void> {
  await document.fonts.ready;
  await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

  for (const root of document.querySelectorAll<HTMLElement>("[data-life-root]")) {
    const lines = root.querySelectorAll<HTMLElement>("[data-life-line]");
    const firstLine = lines[0];
    if (lines.length !== lifeFrameHeight || !firstLine) continue;
    installLifeInstance(root, firstLine);
  }
}

function installLifeInstance(root: HTMLElement, firstLine: HTMLElement): void {
  const grid = installGrid(root, firstLine);
  let pixels: HTMLElement[] | undefined;
  let cells = new Uint8Array(lifeColumnCount * lifeRowCount);
  let nextCells = new Uint8Array(cells.length);
  let intervalId = 0;
  let positionFrameId = 0;

  const renderChanges = () => {
    pixels?.forEach((pixel, index) => {
      if (cells[index] !== nextCells[index]) {
        pixel.classList.toggle("is-alive", cells[index] === 1);
      }
    });
  };
  const tick = () => {
    const population = advanceLifeGeneration(cells, nextCells, lifeColumnCount);
    const previousCells = cells;
    cells = nextCells;
    nextCells = previousCells;
    if (population < 8) seedLifeCells(cells, lifeColumnCount);
    renderChanges();
  };
  const position = () => {
    if (positionFrameId !== 0) return;
    positionFrameId = window.requestAnimationFrame(() => {
      positionFrameId = 0;
      positionGrid(root, firstLine);
    });
  };

  observeAnimationActivity((active) => {
    if (!active) {
      window.clearInterval(intervalId);
      intervalId = 0;
      window.cancelAnimationFrame(positionFrameId);
      positionFrameId = 0;
      return;
    }
    if (!pixels) {
      pixels = Array.from({ length: cells.length }, () => {
        const pixel = document.createElement("span");
        pixel.className = "life-pixel";
        grid.append(pixel);
        return pixel;
      });
      seedLifeCells(cells, lifeColumnCount);
      renderChanges();
    }
    position();
    intervalId = window.setInterval(tick, generationIntervalMs);
  }, grid);
  window.addEventListener("resize", position, { passive: true });
  window.addEventListener("orientationchange", position, { passive: true });
}

function installGrid(root: HTMLElement, firstLine: HTMLElement): HTMLElement {
  const grid = document.createElement("span");
  grid.className = "life-grid";
  grid.style.setProperty("--life-grid-width", String(lifeColumnCount));
  grid.style.setProperty("--life-grid-height", String(lifeRowCount));
  root.append(grid);
  positionGrid(root, firstLine);

  return grid;
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
  const gridWidth = lifeColumnCount * pixelSize;
  const gridHeight = lifeRowCount * pixelSize;
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
  const fillSize = Math.max(innerWidth / lifeColumnCount, innerHeight / lifeRowCount);
  const dimensionDifference = lifeRowCount - lifeColumnCount;
  const equalBleedSize = dimensionDifference === 0 ? fillSize : (innerHeight - innerWidth) / dimensionDifference;

  return Number.isFinite(equalBleedSize) && equalBleedSize >= fillSize ? equalBleedSize : fillSize;
}

function inlinePosition(root: HTMLElement, element: HTMLElement): { left: number; top: number } {
  const rootRect = root.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const zoomScale = ancestorZoomScale(root);

  return {
    left: (elementRect.left - rootRect.left) / zoomScale,
    top: (elementRect.top - rootRect.top) / zoomScale
  };
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

function parseZoom(input: string): number {
  if (input.endsWith("%")) {
    const percentage = Number.parseFloat(input);
    return Number.isFinite(percentage) && percentage > 0 ? percentage / 100 : 1;
  }

  const value = Number.parseFloat(input);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function parseCssPx(input: string): number {
  const value = Number.parseFloat(input);
  return Number.isFinite(value) ? value : 0;
}
