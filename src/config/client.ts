import type { HomeAsciiGlitchConfig, ParticleConfig } from "./types";

// These attributes contain validated, Astro-escaped JSON from their owning
// server components. No browser module imports the root configuration.
export function readParticleConfig(): ParticleConfig | null {
  return JSON.parse(document.body.dataset.particleConfig ?? "null") as ParticleConfig | null;
}

export function readHomeGlitchConfig(hero: HTMLElement): HomeAsciiGlitchConfig | null {
  return JSON.parse(hero.dataset.glitchConfig ?? "null") as HomeAsciiGlitchConfig | null;
}
