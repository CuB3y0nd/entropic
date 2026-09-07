import type { ParticleConfig, ParticlePageKind } from "@/config/types";
import { maybe, randomBetween, randomInt } from "@/shared/random";

const spawnLocations = ["inside", "right", "left", "bottom"] as const;

export type ParticleState = {
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  opacity: number;
  phase: number;
  phaseStep: number;
};

export type ParticlePointer = {
  x: number;
  y: number;
  forceScale: number;
  radiusScale: number;
  startedAtMs: number;
  durationMs: number;
};

export type PointerInfluence = {
  readonly x: number;
  readonly y: number;
  readonly radiusPx: number;
  readonly forceScale: number;
};

export function resetParticleState(
  config: ParticleConfig,
  particle: ParticleState,
  width: number,
  height: number,
  pageKind: ParticlePageKind,
  spawnInViewport: boolean
): void {
  const spawnLocation = spawnInViewport ? "inside" : spawnLocations[randomInt(0, spawnLocations.length - 1)];
  particle.x =
    spawnLocation === "right"
      ? width + randomBetween(4, 20)
      : spawnLocation === "left"
        ? -randomBetween(4, 20)
        : randomParticleX(config, width, pageKind);
  particle.y = spawnLocation === "bottom" ? height + randomBetween(4, 20) : randomBetween(0, height);
  particle.driftX = randomBetween(...config.driftX);
  particle.driftY = randomBetween(...config.driftY);
  const [minimumOpacity, maximumOpacity] = config.pages[pageKind].opacity;
  particle.opacity = randomBetween(minimumOpacity, maximumOpacity);
  particle.phase = randomBetween(0, Math.PI * 2);
  particle.phaseStep = randomBetween(...config.phaseStep);
}

/** Resolve time-dependent pointer values once per frame, outside the particle loop. */
export function resolvePointerInfluence(
  config: ParticleConfig,
  pointer: ParticlePointer,
  timeMs: number,
  pageKind: ParticlePageKind
): PointerInfluence | undefined {
  if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return undefined;
  const progress = pointer.durationMs === 0 ? 0 : Math.max(0, timeMs - pointer.startedAtMs) / pointer.durationMs;
  if (progress >= 1) return undefined;
  const falloff = (1 - progress) ** 1.4;
  return {
    x: pointer.x,
    y: pointer.y,
    radiusPx: config.pointerInfluenceRadius * pointer.radiusScale * (0.72 + falloff * 0.28),
    forceScale: config.pages[pageKind].pointerScale * pointer.forceScale * falloff
  };
}

export function advanceParticle(
  particle: ParticleState,
  influence: PointerInfluence | undefined,
  motionStep: number,
  pointerStep: number
): void {
  particle.x += particle.driftX * motionStep;
  particle.y += particle.driftY * motionStep;
  if (influence) applyPointerInfluence(particle, influence, pointerStep);
  particle.phase += particle.phaseStep * motionStep;
}

function applyPointerInfluence(particle: ParticleState, influence: PointerInfluence, pointerStep: number): void {
  const dx = particle.x - influence.x;
  const dy = particle.y - influence.y;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared > influence.radiusPx * influence.radiusPx) return;

  const distance = Math.sqrt(distanceSquared);
  const force = (1 - distance / influence.radiusPx) ** 2 * influence.forceScale * pointerStep;
  const unitX = distance > 0 ? dx / distance : Math.cos(particle.phase);
  const unitY = distance > 0 ? dy / distance : Math.sin(particle.phase);
  particle.x += unitX * force * 1.8;
  particle.y += unitY * force * 1.2;
  particle.phase += force * 0.08;
}

function randomParticleX(config: ParticleConfig, width: number, pageKind: ParticlePageKind): number {
  if (pageKind === "home" || width <= config.contentSafeWidth + 120) return randomBetween(0, width);
  const gutter = Math.max(0, (width - config.contentSafeWidth) / 2);
  return maybe(0.5)
    ? randomBetween(0, Math.max(1, gutter * 0.82))
    : randomBetween(Math.min(width, width - gutter * 0.82), width);
}
