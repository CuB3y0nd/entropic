import type { ParticleConfig } from "@/config/types";
import { observeAnimationActivity } from "@/shared/browser/animation-activity";
import { randomInt } from "@/shared/random";
import { detectParticlePageKind, readParticleProfile } from "./profile";
import {
  advanceParticle,
  type ParticlePointer,
  type ParticleState,
  resetParticleState,
  resolvePointerInfluence
} from "./simulation";
import "../styles/particles.css";

const tapInfluenceMs = 620;
const pointerMotionReferenceMs = 42;
let installed = false;

type ParticleSprite = ParticleState & { readonly element: HTMLSpanElement };

export function installAsciiParticles(config: ParticleConfig): void {
  if (!config.enabled || installed) return;
  installed = true;

  const pageKind = detectParticlePageKind();
  let profile = readParticleProfile(config, pageKind);
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let layer: HTMLDivElement | undefined;
  const particles: ParticleSprite[] = [];
  const pointer: ParticlePointer = {
    x: Number.NaN,
    y: Number.NaN,
    forceScale: 1,
    radiusScale: 1,
    startedAtMs: 0,
    durationMs: 0
  };
  let animationFrameId = 0;
  let resizeFrameId = 0;
  let lastRenderedAtMs = 0;
  let running = false;
  let animationAllowed = false;

  const resetParticle = (particle: ParticleSprite, spawnInViewport: boolean) => {
    resetParticleState(config, particle, viewportWidth, viewportHeight, pageKind, spawnInViewport);
    particle.element.textContent = config.chars[randomInt(0, config.chars.length - 1)] ?? config.chars[0];
  };
  const reconcileParticles = () => {
    if (!layer) return;
    while (particles.length > profile.count) particles.pop()?.element.remove();
    while (particles.length < profile.count) {
      const element = document.createElement("span");
      const particle = { element, x: 0, y: 0, driftX: 0, driftY: 0, opacity: 0, phase: 0, phaseStep: 0 };
      particles.push(particle);
      layer.append(element);
    }
    for (const particle of particles) resetParticle(particle, true);
  };
  const clearPointer = () => {
    pointer.x = Number.NaN;
    pointer.y = Number.NaN;
  };
  const frame = (timeMs: number) => {
    animationFrameId = 0;
    if (!running || !layer?.isConnected) return;

    const elapsedMs = lastRenderedAtMs === 0 ? profile.motionReferenceMs : timeMs - lastRenderedAtMs;
    // Time-based motion needs no DOM write on every 120/144 Hz refresh.
    if (elapsedMs >= profile.minimumFrameIntervalMs - 1) {
      lastRenderedAtMs = timeMs;
      const motionStep = Math.min(96, elapsedMs) / profile.motionReferenceMs;
      const influence = resolvePointerInfluence(config, pointer, timeMs, pageKind);
      const pointerStep = Math.min(96, elapsedMs) / Math.min(profile.motionReferenceMs, pointerMotionReferenceMs);
      for (const particle of particles) {
        advanceParticle(particle, influence, motionStep, pointerStep);
        const flicker = 0.72 + Math.sin(timeMs * 0.0017 + particle.phase) * 0.28;
        particle.element.style.opacity = (particle.opacity * flicker).toFixed(3);
        particle.element.style.transform = `translate3d(${particle.x.toFixed(2)}px, ${particle.y.toFixed(2)}px, 0)`;
        if (
          particle.y < -24 ||
          particle.y > viewportHeight + 24 ||
          particle.x < -24 ||
          particle.x > viewportWidth + 24
        ) {
          resetParticle(particle, false);
        }
      }
    }
    animationFrameId = window.requestAnimationFrame(frame);
  };

  const updateActivity = () => {
    const shouldRun = animationAllowed && profile.count > 0;
    if (running === shouldRun) return;
    running = shouldRun;
    clearPointer();
    lastRenderedAtMs = 0;
    if (!running) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
      if (layer) layer.hidden = true;
      return;
    }
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "ascii-particles";
      layer.dataset.particleContext = pageKind;
      layer.setAttribute("aria-hidden", "true");
      document.body.append(layer);
      reconcileParticles();
    }
    layer.hidden = false;
    animationFrameId = window.requestAnimationFrame(frame);
  };

  observeAnimationActivity((active) => {
    animationAllowed = active;
    updateActivity();
  });

  const resize = () => {
    if (resizeFrameId !== 0) return;
    resizeFrameId = window.requestAnimationFrame(() => {
      resizeFrameId = 0;
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      profile = readParticleProfile(config, pageKind);
      clearPointer();
      reconcileParticles();
      updateActivity();
    });
  };
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("orientationchange", resize, { passive: true });
  window.addEventListener("pointerleave", clearPointer, { passive: true });
  window.addEventListener(
    "pointermove",
    (event) => {
      if (!running || !profile.trackHover || event.pointerType !== "mouse") return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.forceScale = 1;
      pointer.radiusScale = 1;
      pointer.durationMs = 0;
    },
    { passive: true }
  );
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (!running || event.pointerType === "mouse") return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.forceScale = 1.62;
      pointer.radiusScale = 1.42;
      pointer.startedAtMs = performance.now();
      pointer.durationMs = tapInfluenceMs;
    },
    { passive: true }
  );
}
