import { effectsConfig } from "../../../config";

type GlitchZone = {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  strength: number;
  decay: number;
  collapseBias: number;
};

const asciiGlitchCharset = Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index)).join("");
const asciiGlitchUppercaseSubstitutions = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const decayFrameMinMs = 24;
const decayFrameMaxMs = 86;

export function initHomeAsciiGlitch(): void {
  const config = effectsConfig.homeAsciiGlitch;

  if (!config.enable || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const hero = document.querySelector<HTMLElement>(".ascii-hero");
  const base = document.getElementById("home-ascii");
  const glitch = document.getElementById("home-ascii-glitch");

  if (!(hero instanceof HTMLElement) || !(base instanceof HTMLElement) || !(glitch instanceof HTMLElement)) {
    return;
  }

  const source = base.dataset.asciiText ?? base.textContent ?? "";

  if (!source) {
    return;
  }

  let idleTimeoutId = 0;
  let frameTimeoutId = 0;
  let burstActive = false;
  let followupBudget = 0;
  let lingeringZones: GlitchZone[] = [];
  let lastGlitchFrame = "";

  const schedule = () => {
    if (document.visibilityState !== "visible") {
      return;
    }

    window.clearTimeout(idleTimeoutId);
    const nextDelay =
      followupBudget > 0 && maybe(0.58)
        ? randomBetween(config.minIntervalMs * 0.18, config.minIntervalMs * 0.55)
        : chooseWeightedDelays(config.minIntervalMs, config.maxIntervalMs);
    idleTimeoutId = window.setTimeout(trigger, nextDelay);
  };

  const runBurstFrame = (remainingFrames: number) => {
    if (remainingFrames <= 0) {
      runDecayFrame(randomInt(2, 5), lastGlitchFrame || glitch.textContent || source);
      return;
    }

    const mutationRatio = randomBetween(config.mutationRatioMin, config.mutationRatioMax);
    const zones = createGlitchZones(source.split("\n"), lingeringZones);
    lingeringZones = zones
      .filter((zone) => zone.decay > 0 && maybe(0.58))
      .map((zone) => ({
        ...zone,
        rowStart: Math.max(0, zone.rowStart + randomInt(-1, 1)),
        rowEnd: Math.max(zone.rowStart + 1, zone.rowEnd + randomInt(-1, 1)),
        colStart: Math.max(0, zone.colStart + randomInt(-3, 3)),
        colEnd: Math.max(zone.colStart + 2, zone.colEnd + randomInt(-3, 3)),
        strength: Math.max(0.16, zone.strength * randomBetween(0.72, 0.94)),
        decay: zone.decay - 1,
        collapseBias: Math.min(0.72, zone.collapseBias * randomBetween(0.92, 1.08))
      }));

    base.textContent = createBaseFrame(
      source,
      Math.max(config.mutationRatioMin * 0.5, mutationRatio * randomBetween(0.32, 0.55)),
      config.lineShiftChance,
      zones
    );
    lastGlitchFrame = createGlitchFrame(source, mutationRatio, config.lineShiftChance, zones);
    glitch.textContent = lastGlitchFrame;
    applyGlitchVisualState(hero);
    hero.classList.add("is-glitching");
    frameTimeoutId = window.setTimeout(
      () => runBurstFrame(remainingFrames - 1),
      randomBetween(config.frameMinMs, config.frameMaxMs)
    );
  };

  const trigger = () => {
    if (burstActive) {
      schedule();
      return;
    }

    window.clearTimeout(idleTimeoutId);
    idleTimeoutId = 0;
    burstActive = true;
    if (followupBudget === 0 && maybe(0.34)) {
      followupBudget = randomInt(1, 3);
    }
    runBurstFrame(randomInt(config.burstFrameMin, config.burstFrameMax));
  };

  const runDecayFrame = (remainingFrames: number, previousFrame: string) => {
    if (remainingFrames <= 0) {
      finishBurst();
      return;
    }

    const progress = 1 - remainingFrames / Math.max(1, remainingFrames + 1);
    const keepRatio = randomBetween(0.08, 0.34) * (1 - progress * 0.55);
    const baseDropRatio = randomBetween(0.01, 0.035) * remainingFrames;
    const ghostFrame = createDecayFrame(previousFrame, keepRatio);
    base.textContent = createBaseFrame(source, baseDropRatio, config.lineShiftChance * 0.25, lingeringZones);
    glitch.textContent = ghostFrame;
    applyGlitchDecayVisualState(hero, remainingFrames);
    hero.classList.add("is-glitching");

    frameTimeoutId = window.setTimeout(
      () => runDecayFrame(remainingFrames - 1, ghostFrame),
      randomBetween(decayFrameMinMs, decayFrameMaxMs)
    );
  };

  const finishBurst = () => {
    burstActive = false;
    frameTimeoutId = 0;
    lastGlitchFrame = "";
    hero.classList.remove("is-glitching");
    base.textContent = source;
    glitch.textContent = "";
    clearGlitchVisualState(hero);
    if (followupBudget > 0) {
      followupBudget -= 1;
    }
    schedule();
  };

  const reset = () => {
    window.clearTimeout(idleTimeoutId);
    window.clearTimeout(frameTimeoutId);
    idleTimeoutId = 0;
    frameTimeoutId = 0;
    burstActive = false;
    lastGlitchFrame = "";
    hero.classList.remove("is-glitching");
    base.textContent = source;
    glitch.textContent = "";
    clearGlitchVisualState(hero);
  };

  schedule();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      schedule();
      return;
    }

    reset();
  });
  window.addEventListener("beforeunload", () => {
    window.clearTimeout(idleTimeoutId);
    window.clearTimeout(frameTimeoutId);
  });
}

function sampleGlitchCharacter(source: string): string {
  if (/[A-Z]/.test(source)) {
    return (
      asciiGlitchUppercaseSubstitutions[Math.floor(Math.random() * asciiGlitchUppercaseSubstitutions.length)] ?? "E"
    );
  }
  if (/[0-9]/.test(source)) {
    return String(Math.floor(Math.random() * 10));
  }
  return asciiGlitchCharset[Math.floor(Math.random() * asciiGlitchCharset.length)] ?? ".";
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function maybe(probability: number): boolean {
  return Math.random() < probability;
}

function chooseWeightedDelays(min: number, max: number): number {
  const span = Math.max(1, max - min);
  const roll = Math.random();

  if (roll < 0.16) {
    return randomBetween(min, min + span * 0.18);
  }
  if (roll < 0.72) {
    return randomBetween(min + span * 0.28, min + span * 0.72);
  }
  return randomBetween(min + span * 0.7, max);
}

function mutateLine(line: string, mutationRatio: number, start = 0, end = line.length): string {
  const chars = line.split("");
  const mutableIndices = chars
    .map((char, index) => ({ char, index }))
    .filter(({ char, index }) => index >= start && index < end && !/\s/.test(char))
    .map(({ index }) => index);

  if (mutableIndices.length === 0) {
    return line;
  }

  const targetCount = Math.max(1, Math.floor(mutableIndices.length * mutationRatio));
  for (let i = 0; i < targetCount; i += 1) {
    const index = mutableIndices[randomInt(0, mutableIndices.length - 1)] ?? 0;
    chars[index] = sampleGlitchCharacter(chars[index] ?? " ");
  }

  return chars.join("");
}

function shiftSegment(line: string, start: number, end: number): string {
  const chars = line.split("");
  const boundedStart = Math.max(0, Math.min(start, chars.length));
  const boundedEnd = Math.max(boundedStart, Math.min(end, chars.length));
  const segment = chars.slice(boundedStart, boundedEnd).join("");

  if (!segment) {
    return line;
  }

  const offset = randomInt(-5, 5);
  if (offset === 0) {
    return line;
  }

  const shifted =
    offset > 0
      ? `${" ".repeat(offset)}${segment}`.slice(0, segment.length)
      : `${segment.slice(Math.min(-offset, segment.length))}${" ".repeat(Math.min(-offset, segment.length))}`.slice(
          0,
          segment.length
        );

  chars.splice(boundedStart, boundedEnd - boundedStart, ...shifted.split(""));
  return chars.join("");
}

function corruptSegment(line: string, start: number, end: number, collapseBias = 0): string {
  const chars = line.split("");
  const boundedStart = Math.max(0, Math.min(start, chars.length));
  const boundedEnd = Math.max(boundedStart, Math.min(end, chars.length));

  if (boundedEnd <= boundedStart) {
    return line;
  }

  const mode = maybe(collapseBias) ? 2 : randomInt(0, 3);
  if (mode === 0) {
    const count = randomInt(1, Math.max(1, Math.min(4, boundedEnd - boundedStart)));
    for (let i = 0; i < count; i += 1) {
      const index = randomInt(boundedStart, boundedEnd - 1);
      chars[index] = maybe(0.6) ? " " : sampleGlitchCharacter(chars[index] ?? " ");
    }
  } else if (mode === 1) {
    const anchor = randomInt(boundedStart, boundedEnd - 1);
    const source = chars[anchor] ?? " ";
    const count = randomInt(1, Math.max(1, Math.min(5, boundedEnd - anchor)));
    for (let i = 0; i < count; i += 1) {
      chars[Math.min(anchor + i, boundedEnd - 1)] = source;
    }
  } else if (mode === 2) {
    const segment = chars.slice(boundedStart, boundedEnd);
    const collapsed = segment.filter((_, index) => index % 2 === 0);
    const padded = [...collapsed, ...Array(Math.max(0, segment.length - collapsed.length)).fill(" ")];
    chars.splice(boundedStart, boundedEnd - boundedStart, ...padded);
  } else {
    const count = randomInt(1, Math.max(1, Math.min(4, boundedEnd - boundedStart)));
    for (let i = 0; i < count; i += 1) {
      const index = randomInt(boundedStart, boundedEnd - 1);
      chars[index] = maybe(0.5) ? "_" : sampleGlitchCharacter(chars[index] ?? " ");
    }
  }

  return chars.join("");
}

function erodeSegment(line: string, start: number, end: number, strength: number): string {
  const chars = line.split("");
  const boundedStart = Math.max(0, Math.min(start, chars.length));
  const boundedEnd = Math.max(boundedStart, Math.min(end, chars.length));

  if (boundedEnd <= boundedStart) {
    return line;
  }

  for (let index = boundedStart; index < boundedEnd; index += 1) {
    if (/\s/.test(chars[index] ?? "")) {
      continue;
    }
    if (maybe(0.06 + strength * 0.2)) {
      chars[index] = " ";
    } else if (maybe(0.04 + strength * 0.12)) {
      chars[index] = ".";
    }
  }

  return chars.join("");
}

function collapseSegment(line: string, start: number, end: number, strength: number): string {
  const chars = line.split("");
  const boundedStart = Math.max(0, Math.min(start, chars.length));
  const boundedEnd = Math.max(boundedStart, Math.min(end, chars.length));
  const segment = chars.slice(boundedStart, boundedEnd);

  if (segment.length === 0) {
    return line;
  }

  const stride = strength > 0.72 ? 3 : 2;
  const collapsed = segment.filter((_, index) => index % stride === 0);
  const padding = Array(Math.max(0, segment.length - collapsed.length)).fill(" ");
  chars.splice(boundedStart, boundedEnd - boundedStart, ...collapsed, ...padding);
  return chars.join("");
}

function createGlitchZones(lines: string[], carryover: GlitchZone[] = []): GlitchZone[] {
  const maxWidth = Math.max(...lines.map((line) => line.length), 0);
  const zoneCount = randomInt(1, 3);
  const fresh = Array.from({ length: zoneCount }, () => {
    const rowStart = randomInt(0, Math.max(0, lines.length - 1));
    const rowSpan = randomInt(1, Math.max(1, Math.min(4, lines.length - rowStart)));
    const colStart = randomInt(0, Math.max(0, Math.max(0, maxWidth - 8)));
    const colSpan = randomInt(6, Math.max(6, Math.min(30, Math.max(6, maxWidth - colStart))));

    return {
      rowStart,
      rowEnd: rowStart + rowSpan,
      colStart,
      colEnd: Math.min(maxWidth, colStart + colSpan),
      strength: randomBetween(0.35, 1),
      decay: randomInt(1, 3),
      collapseBias: randomBetween(0.08, 0.45)
    };
  });

  return [...carryover.map((zone) => ({ ...zone })), ...fresh];
}

function zoneAffectsRow(zone: GlitchZone, rowIndex: number): boolean {
  return rowIndex >= zone.rowStart && rowIndex < zone.rowEnd;
}

function distortZone(line: string, zone: GlitchZone, mutationRatio: number, lineShiftChance: number): string {
  let next = mutateLine(line, mutationRatio * (0.7 + zone.strength * 0.75), zone.colStart, zone.colEnd);
  if (maybe(lineShiftChance * (0.65 + zone.strength * 0.45))) {
    next = shiftSegment(next, zone.colStart, zone.colEnd);
  }
  if (maybe(0.42 + zone.strength * 0.4)) {
    next = corruptSegment(next, zone.colStart, zone.colEnd, zone.collapseBias);
  }
  if (maybe(0.24 + zone.strength * 0.3)) {
    next = erodeSegment(next, zone.colStart, zone.colEnd, zone.strength);
  }
  if (maybe(zone.collapseBias * 0.35)) {
    next = collapseSegment(next, zone.colStart, zone.colEnd, zone.strength);
  }
  return next;
}

function createGlitchFrame(
  source: string,
  mutationRatio: number,
  lineShiftChance: number,
  zones: GlitchZone[]
): string {
  return source
    .split("\n")
    .map((line, rowIndex) => {
      let next = line;
      for (const zone of zones) {
        if (zoneAffectsRow(zone, rowIndex)) {
          next = distortZone(next, zone, mutationRatio, lineShiftChance);
        }
      }
      return next;
    })
    .join("\n");
}

function createBaseFrame(source: string, mutationRatio: number, lineShiftChance: number, zones: GlitchZone[]): string {
  return source
    .split("\n")
    .map((line, rowIndex) => {
      let next = line;
      for (const zone of zones) {
        if (!zoneAffectsRow(zone, rowIndex)) {
          continue;
        }
        next = mutateLine(next, mutationRatio * (0.4 + zone.strength * 0.28), zone.colStart, zone.colEnd);
        if (maybe(lineShiftChance * 0.2)) {
          next = shiftSegment(next, zone.colStart, zone.colEnd);
        }
        if (maybe(0.14 + zone.strength * 0.18)) {
          next = erodeSegment(next, zone.colStart, zone.colEnd, zone.strength * 0.9);
        }
        if (maybe(zone.collapseBias * 0.18)) {
          next = collapseSegment(next, zone.colStart, zone.colEnd, zone.strength * 0.7);
        }
      }
      if (maybe(0.16) && next.trim()) {
        const chars = next.split("");
        const spliceStart = randomInt(0, Math.max(0, chars.length - 1));
        const spliceLength = randomInt(1, Math.max(1, Math.min(6, chars.length - spliceStart)));
        for (let i = 0; i < spliceLength; i += 1) {
          const index = spliceStart + i;
          if (!chars[index] || /\s/.test(chars[index] ?? "")) {
            continue;
          }
          chars[index] = sampleGlitchCharacter(chars[index]);
        }
        next = chars.join("");
      }
      return next;
    })
    .join("\n");
}

function createDecayFrame(source: string, keepRatio: number): string {
  const lines = source.split("\n");
  const rowWindow = randomDecayWindow(lines.length);

  return lines
    .map((line, rowIndex) => {
      if (rowIndex < rowWindow.start || rowIndex >= rowWindow.end) {
        return blankLine(line);
      }

      return line
        .split("")
        .map((char) => {
          if (/\s/.test(char)) {
            return " ";
          }

          if (maybe(keepRatio)) {
            return maybe(0.28) ? sampleGlitchCharacter(char) : char;
          }

          return maybe(0.04) ? "." : " ";
        })
        .join("");
    })
    .join("\n");
}

function randomDecayWindow(lineCount: number): { start: number; end: number } {
  if (lineCount <= 0) {
    return { start: 0, end: 0 };
  }

  const start = randomInt(0, Math.max(0, lineCount - 1));
  const span = randomInt(1, Math.max(1, Math.min(4, lineCount - start)));
  return { start, end: start + span };
}

function blankLine(line: string): string {
  return " ".repeat(line.length);
}

function applyGlitchVisualState(hero: HTMLElement): void {
  const scanLeft = randomBetween(0, 42);
  const scanWidth = randomBetween(8, 100 - scanLeft);
  hero.style.setProperty("--ascii-scan-top", `${randomBetween(3, 82)}%`);
  hero.style.setProperty("--ascii-scan-height", `${randomBetween(5, 38)}%`);
  hero.style.setProperty("--ascii-scan-left", `${scanLeft.toFixed(2)}%`);
  hero.style.setProperty("--ascii-scan-width", `${scanWidth.toFixed(2)}%`);
  hero.style.setProperty("--ascii-scan-opacity", randomBetween(0.35, 0.98).toFixed(2));
  hero.style.setProperty("--ascii-glitch-opacity", randomBetween(0.4, 1).toFixed(2));
  hero.style.setProperty("--ascii-glitch-shift-x", `${randomInt(-12, 12)}px`);
  hero.style.setProperty("--ascii-glitch-shift-y", `${randomInt(-4, 4)}px`);
  hero.style.setProperty("--ascii-glitch-shadow-a", `${randomInt(1, 8)}px`);
  hero.style.setProperty("--ascii-glitch-shadow-b", `${randomInt(-8, -1)}px`);
  hero.style.setProperty("--ascii-glitch-clip-top", `${randomBetween(0, 70).toFixed(2)}%`);
  hero.style.setProperty("--ascii-glitch-clip-right", `${randomBetween(0, 58).toFixed(2)}%`);
  hero.style.setProperty("--ascii-glitch-clip-bottom", `${randomBetween(0, 42).toFixed(2)}%`);
  hero.style.setProperty("--ascii-glitch-clip-left", `${randomBetween(0, 58).toFixed(2)}%`);
  hero.style.setProperty("--ascii-bloom-x", `${randomBetween(8, 92).toFixed(2)}%`);
  hero.style.setProperty("--ascii-bloom-y", `${randomBetween(8, 92).toFixed(2)}%`);
  hero.style.setProperty("--ascii-bloom-opacity", randomBetween(0.01, 0.05).toFixed(2));
}

function applyGlitchDecayVisualState(hero: HTMLElement, remainingFrames: number): void {
  applyGlitchVisualState(hero);
  const fade = Math.min(1, Math.max(0.12, remainingFrames / 5));
  hero.style.setProperty("--ascii-scan-opacity", randomBetween(0.08, 0.26 * fade).toFixed(2));
  hero.style.setProperty("--ascii-glitch-opacity", randomBetween(0.1, 0.46 * fade).toFixed(2));
  hero.style.setProperty("--ascii-bloom-opacity", "0");
  hero.style.setProperty("--ascii-glitch-shift-x", `${randomInt(-5, 5)}px`);
  hero.style.setProperty("--ascii-glitch-shift-y", `${randomInt(-2, 2)}px`);
  hero.style.setProperty("--ascii-glitch-shadow-a", `${randomInt(1, 3)}px`);
  hero.style.setProperty("--ascii-glitch-shadow-b", `${randomInt(-3, -1)}px`);
}

function clearGlitchVisualState(hero: HTMLElement): void {
  [
    "--ascii-scan-top",
    "--ascii-scan-height",
    "--ascii-scan-left",
    "--ascii-scan-width",
    "--ascii-scan-opacity",
    "--ascii-glitch-opacity",
    "--ascii-glitch-shift-x",
    "--ascii-glitch-shift-y",
    "--ascii-glitch-shadow-a",
    "--ascii-glitch-shadow-b",
    "--ascii-glitch-clip-top",
    "--ascii-glitch-clip-right",
    "--ascii-glitch-clip-bottom",
    "--ascii-glitch-clip-left",
    "--ascii-bloom-x",
    "--ascii-bloom-y",
    "--ascii-bloom-opacity"
  ].forEach((property) => {
    hero.style.removeProperty(property);
  });
}
