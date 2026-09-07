import { randomBetween, randomInt } from "@/shared/random";

export function applyGlitchVisualState(hero: HTMLElement): void {
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

export function applyGlitchDecayVisualState(hero: HTMLElement, remainingFrames: number): void {
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

export function clearGlitchVisualState(hero: HTMLElement): void {
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
