import { observeAnimationActivity } from "@/shared/browser/animation-activity";
import { createAlgorithm, renderBars } from "./engine";
import type { AlgorithmFrame } from "./frame";
import { algorithmKinds } from "./model";

let installed = false;

export function installAlgorithmArt(): void {
  if (installed) return;
  installed = true;
  for (const root of document.querySelectorAll<HTMLElement>("[data-algorithm-art]")) {
    const kind = algorithmKinds.find((value) => value === root.dataset.algorithmArt);
    if (!kind || kind === "life") continue;
    const algorithm = createAlgorithm(kind, root.dataset.key ?? "");
    const speed = Number(root.dataset.speed) || 1;
    let current = algorithm.next(); // Same initial frame as the server-rendered HTML.
    const labels = root.querySelector("[data-algorithm-labels]");
    if (labels) {
      const draw = labelRenderer(labels);
      draw(current);
      animateSteps(root, algorithm.intervalMs / speed, () => draw(algorithm.next()));
      continue;
    }
    const svg = root.querySelector("svg");
    const field = root.querySelector("[data-algorithm-field]");
    const ink = root.querySelector("[data-algorithm-ink]");
    const trail = root.querySelector("[data-algorithm-trail]");
    const accent = root.querySelector("[data-algorithm-accent]");
    const motion = root.querySelector("[data-algorithm-motion]");
    if (!svg || !field || !ink || !trail || !accent || !motion) continue;
    const blocks = [...motion.querySelectorAll("rect")];
    let requestId = 0;
    let previousTime: number | undefined;
    let elapsed = 0;
    let scaleX = 1;
    let scaleY = 1;
    let pixelWidth = 184;
    let pixelHeight = 210;
    let originX = 0;
    let originY = 0;
    const fit = () => {
      const bounds = svg.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      pixelWidth = bounds.width * window.devicePixelRatio;
      pixelHeight = bounds.height * window.devicePixelRatio;
      originX = bounds.left * window.devicePixelRatio;
      originY = bounds.top * window.devicePixelRatio;
      scaleX = pixelWidth / svg.viewBox.baseVal.width || 1;
      scaleY = pixelHeight / svg.viewBox.baseVal.height || 1;
      drawStep();
      drawPosition();
    };
    const snap = (value: number, scale: number) => (Math.round(value * scale) / scale).toFixed(3);
    const drawStep = () => {
      const paths = current.bars
        ? renderBars(
            current.bars.values,
            current.bars.active,
            Math.round(originX + pixelWidth) - Math.round(originX),
            Math.round(originY + pixelHeight) - Math.round(originY),
            Math.max(1, Math.round(2 * scaleX))
          )
        : current;
      if (current.bars) {
        set(
          field,
          "transform",
          `matrix(${1 / scaleX} 0 0 ${1 / scaleY} ${(Math.round(originX) - originX) / scaleX} ${(Math.round(originY) - originY) / scaleY})`
        );
      }
      set(ink, "d", paths.ink);
      set(trail, "d", current.trail ?? "");
      set(accent, "d", paths.accent);
      while (blocks.length < (current.motion?.length ?? 0)) {
        const block = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        blocks.push(block);
        motion.append(block);
      }
      blocks.forEach((block, index) => {
        const shape = current.motion?.[index];
        set(block, "width", shape?.width ?? 0);
        set(block, "height", shape?.height ?? 0);
        set(block, "class", shape?.accent ? "algorithm-accent" : "algorithm-ink");
      });
    };
    const drawPosition = () => {
      const progress = elapsed / algorithm.intervalMs;
      const ease = progress * progress * (3 - 2 * progress);
      current.motion?.forEach((shape, index) => {
        const block = blocks[index];
        if (!block) return;
        set(block, "x", snap(shape.fromX + (shape.x - shape.fromX) * ease, scaleX));
        set(block, "y", snap(shape.fromY + (shape.y - shape.fromY) * ease, scaleY));
      });
    };
    const tick = (time: number) => {
      if (previousTime !== undefined) elapsed += Math.min(time - previousTime, 64) * speed;
      previousTime = time;
      while (elapsed >= algorithm.intervalMs) {
        elapsed -= algorithm.intervalMs;
        current = algorithm.next();
        drawStep();
      }
      drawPosition();
      requestId = requestAnimationFrame(tick);
    };
    new ResizeObserver(fit).observe(svg);
    window.addEventListener("resize", fit, { passive: true });
    fit();
    if (!current.motion) {
      animateSteps(root, algorithm.intervalMs / speed, () => {
        current = algorithm.next();
        drawStep();
      });
      continue;
    }
    if (!root.hasAttribute("data-animated")) continue;
    observeAnimationActivity((active) => {
      cancelAnimationFrame(requestId);
      previousTime = undefined;
      if (!active) return;
      fit();
      requestId = requestAnimationFrame(tick);
    }, root);
  }
}

/** Discrete effects sleep between steps; only the maze needs intermediate cursor positions. */
function animateSteps(root: HTMLElement, intervalMs: number, draw: () => void): void {
  if (!root.hasAttribute("data-animated")) return;
  let timer: number | undefined;
  observeAnimationActivity((active) => {
    window.clearInterval(timer);
    if (active) timer = window.setInterval(draw, intervalMs);
  }, root);
}

function labelRenderer(root: Element): (frame: AlgorithmFrame) => void {
  const nodes = [...root.querySelectorAll("span")];
  return (frame) => {
    const labels = frame.labels ?? [];
    while (nodes.length > labels.length) nodes.pop()?.remove();
    labels.forEach((label, index) => {
      let node = nodes[index];
      if (!node) {
        node = document.createElement("span");
        nodes.push(node);
        root.append(node);
      }
      set(node, "class", `algorithm-label algorithm-label-${label.tone}`);
      set(node, "style", `left:${label.column}ch;top:${label.row}lh`);
      if (node.textContent !== label.text) node.textContent = label.text;
    });
  };
}

function set(element: Element, name: string, value: string | number): void {
  const text = String(value);
  if (element.getAttribute(name) !== text) element.setAttribute(name, text);
}
