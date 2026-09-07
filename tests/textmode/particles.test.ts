import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultEffects } from "../../src/config/defaults";
import {
  advanceParticle,
  type ParticlePointer,
  type ParticleState,
  resolvePointerInfluence
} from "../../src/shared/textmode/particles/simulation";

function particle(): ParticleState {
  return { x: 10, y: 20, driftX: 0.2, driftY: -0.5, opacity: 0.5, phase: 0, phaseStep: 0.05 };
}

test("particle drift follows elapsed time independently of display refresh rate", () => {
  const normal = particle();
  const fast = particle();
  advanceParticle(normal, undefined, 1, 1);
  for (let frame = 0; frame < 4; frame += 1) advanceParticle(fast, undefined, 0.25, 0.25);
  assert.ok(Math.abs(normal.x - fast.x) < 1e-10);
  assert.ok(Math.abs(normal.y - fast.y) < 1e-10);
  assert.equal(normal.phase, fast.phase);
});

test("tap influence decays, expires at its deadline and ignores a missing pointer", () => {
  const pointer: ParticlePointer = {
    x: 100,
    y: 100,
    forceScale: 1,
    radiusScale: 1,
    startedAtMs: 1000,
    durationMs: 620
  };
  const initial = resolvePointerInfluence(defaultEffects.particles, pointer, 1000, "home");
  const halfway = resolvePointerInfluence(defaultEffects.particles, pointer, 1310, "home");
  assert.ok(initial && halfway);
  assert.ok(halfway.forceScale < initial.forceScale && halfway.radiusPx < initial.radiusPx);
  assert.equal(resolvePointerInfluence(defaultEffects.particles, pointer, 1620, "home"), undefined);
  assert.equal(
    resolvePointerInfluence(defaultEffects.particles, { ...pointer, x: Number.NaN }, 1000, "home"),
    undefined
  );
});

test("pointer force remains finite at its center and leaves distant particles alone", () => {
  const centered = particle();
  centered.driftX = 0;
  centered.driftY = 0;
  advanceParticle(centered, { x: 10, y: 20, radiusPx: 150, forceScale: 1 }, 1, 1);
  assert.ok(Number.isFinite(centered.x) && Number.isFinite(centered.y) && centered.x > 10);
  const distant = particle();
  const control = particle();
  advanceParticle(distant, { x: 1000, y: 1000, radiusPx: 150, forceScale: 1 }, 1, 1);
  advanceParticle(control, undefined, 1, 1);
  assert.deepEqual(distant, control);
});
