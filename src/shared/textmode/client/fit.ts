import { clearCache, measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";

const fittedSelector = ".home-shell, .textmode-wrap";

export function installTextmodeFit(mobile: MediaQueryList): void {
  // Documents are static. Life and glitch effects preserve the character grid;
  // their animation frames must not trigger another article measurement.
  const targets = [...document.querySelectorAll<HTMLElement>(fittedSelector)]
    .map((element) => ({ element, text: textForFit(element) }))
    .filter(({ text }) => text.length > 0);

  if (targets.length === 0) {
    return;
  }

  let widths: { element: HTMLElement; width: number }[] | undefined;
  let animationFrame = 0;

  const fit = () => {
    if (!mobile.matches || animationFrame !== 0) {
      return;
    }

    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0;
      if (!mobile.matches) {
        return;
      }

      // Natural width is independent of the viewport. Prepare the whole block
      // once, including its hard line breaks, and keep only the resulting width.
      widths ??= targets.map(({ element, text }) => ({
        element,
        width: Math.ceil(measureTextWidth(text, fontFor(element)) + paddingWidth(element))
      }));

      const viewportWidth = document.documentElement.clientWidth;
      for (const { element, width } of widths) {
        const scale = Math.min(1, viewportWidth / Math.max(1, width));
        const scope = element.closest<HTMLElement>("[data-textmode-fit-scope]") ?? element;
        scope.style.setProperty("--fit-scale", scale.toFixed(4));
      }
    });
  };

  void document.fonts.ready.then(() => {
    // A CSS font name stays the same when a web font replaces its fallback.
    // Invalidate Pretext's font-keyed metrics as well as our natural widths.
    // Our font set is static. Use its initial ready promise: Chromium can emit
    // loadingdone again after CSS zoom even though the font has not changed.
    clearCache();
    widths = undefined;
    fit();
  });

  window.addEventListener("resize", fit, { passive: true });
  mobile.addEventListener("change", fit);
  fit();
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
  return measureNaturalWidth(prepareWithSegments(text, font, { whiteSpace: "pre-wrap" }));
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
