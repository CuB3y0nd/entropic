import { readHomeGlitchConfig } from "@/config/client";
import { observeAnimationActivity } from "@/shared/browser/animation-activity";

import { maybe, randomBetween, randomInt } from "@/shared/random";
import {
  chooseWeightedDelays,
  createBaseFrame,
  createDecayFrame,
  createGlitchFrame,
  createGlitchZones,
  type GlitchZone
} from "./frames";
import { applyGlitchDecayVisualState, applyGlitchVisualState, clearGlitchVisualState } from "./visuals";

const decayFrameMinMs = 24;
const decayFrameMaxMs = 86;

export function initHomeAsciiGlitch(): void {
  const hero = document.querySelector<HTMLElement>(".ascii-hero");
  const baseText = document.getElementById("home-ascii");
  const glitchText = document.getElementById("home-ascii-glitch");

  if (!(hero instanceof HTMLElement) || !(baseText instanceof HTMLElement) || !(glitchText instanceof HTMLElement)) {
    return;
  }

  const config = readHomeGlitchConfig(hero);
  if (!config?.enabled) return;

  const sourceText = baseText.dataset.asciiText ?? baseText.textContent ?? "";
  const sourceLines = sourceText.split("\n");

  if (!sourceText) {
    return;
  }

  let animationActive = false;
  let idleTimeoutId = 0;
  let frameTimeoutId = 0;
  let burstActive = false;
  let followupBudget = 0;
  let lingeringZones: GlitchZone[] = [];
  let lastGlitchFrame = "";

  const schedule = () => {
    if (!animationActive) {
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
      runDecayFrame(randomInt(2, 5), lastGlitchFrame || glitchText.textContent || sourceText);
      return;
    }

    const mutationRatio = randomBetween(config.mutationRatioMin, config.mutationRatioMax);
    const zones = createGlitchZones(sourceLines, lingeringZones);
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

    baseText.textContent = createBaseFrame(
      sourceText,
      Math.max(config.mutationRatioMin * 0.5, mutationRatio * randomBetween(0.32, 0.55)),
      config.lineShiftChance,
      zones
    );
    lastGlitchFrame = createGlitchFrame(sourceText, mutationRatio, config.lineShiftChance, zones);
    glitchText.textContent = lastGlitchFrame;
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
    baseText.textContent = createBaseFrame(sourceText, baseDropRatio, config.lineShiftChance * 0.25, lingeringZones);
    glitchText.textContent = ghostFrame;
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
    baseText.textContent = sourceText;
    glitchText.textContent = "";
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
    baseText.textContent = sourceText;
    glitchText.textContent = "";
    clearGlitchVisualState(hero);
  };

  observeAnimationActivity((active) => {
    animationActive = active;
    if (active) schedule();
    else reset();
  }, hero);
}
