import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";

const fittedSelector = ".home-shell, .textmode-wrap";
const fontReadyTimeoutMs = 1200;

export function installTextmodeFit(): void {
  if (typeof window === "undefined") {
    return;
  }

  const fit = createScheduledFit();

  fit();
  window.addEventListener("resize", fit, { passive: true });
  window.addEventListener("orientationchange", fit, { passive: true });

  void waitForFonts().then(fit);
}

function createScheduledFit(): () => void {
  let animationFrame = 0;

  return () => {
    if (animationFrame !== 0) {
      return;
    }

    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0;
      fitTextmodeElements();
    });
  };
}

async function waitForFonts(): Promise<void> {
  if (!("fonts" in document)) {
    return;
  }

  await Promise.race([document.fonts.ready, new Promise((resolve) => window.setTimeout(resolve, fontReadyTimeoutMs))]);
}

function fitTextmodeElements(): void {
  const elements = document.querySelectorAll<HTMLElement>(fittedSelector);

  for (const element of elements) {
    const content = textForFit(element);

    if (content.length === 0) {
      continue;
    }

    const contentWidth = measureTextWidth(content, fontFor(element));
    const horizontalPadding = paddingWidth(element);
    const targetWidth = Math.ceil(contentWidth + horizontalPadding);
    const viewportWidth = document.documentElement.clientWidth;
    const scale = Math.min(1, viewportWidth / Math.max(1, targetWidth));

    element.style.setProperty("--fit-scale", scale.toFixed(4));
  }
}

function textForFit(element: HTMLElement): string {
  return [...element.querySelectorAll("pre")]
    .map((pre) => pre.textContent ?? "")
    .join("\n")
    .trimEnd();
}

function fontFor(element: HTMLElement): string {
  const pre = element.querySelector<HTMLElement>("pre") ?? element;
  const style = window.getComputedStyle(pre);

  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function measureTextWidth(text: string, font: string): number {
  return text.split("\n").reduce((width, line) => {
    if (line.length === 0) {
      return width;
    }

    const prepared = prepareWithSegments(line, font, { whiteSpace: "pre-wrap" });
    return Math.max(width, measureNaturalWidth(prepared));
  }, 0);
}

function paddingWidth(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  const pre = element.querySelector<HTMLElement>("pre");
  const preStyle = pre ? window.getComputedStyle(pre) : undefined;

  return (
    parsePixels(style.paddingLeft) +
    parsePixels(style.paddingRight) +
    parsePixels(preStyle?.paddingLeft) +
    parsePixels(preStyle?.paddingRight)
  );
}

function parsePixels(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
