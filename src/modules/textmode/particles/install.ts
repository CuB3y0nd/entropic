import { effectsConfig, type ParticleContext } from "../../../config";

const particleLayerClass = "ascii-particles";
const config = effectsConfig.particles;

type Particle = {
  element: HTMLSpanElement;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  opacity: number;
  phase: number;
  speed: number;
  context: ParticleContext;
};

type RuntimeProfile = {
  context: ParticleContext;
  frameMs: number;
  countScale: number;
  pointerEnabled: boolean;
  tapEnabled: boolean;
};

type PointerState = {
  x: number;
  y: number;
  forceScale: number;
  radiusScale: number;
  startedAt: number;
  durationMs: number;
};

const frameMsByContext: Record<ParticleContext, { desktop: number; mobile: number }> = {
  home: { desktop: 42, mobile: 50 },
  volume: { desktop: 52, mobile: 66 },
  article: { desktop: 78, mobile: 88 }
};
const tapInfluenceMs = 620;
const tapFrameMs = 42;
const tapForceScale = 1.62;
const tapRadiusScale = 1.42;

export function installAsciiParticles(): void {
  if (
    !config.enable ||
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  if (document.querySelector(`.${particleLayerClass}`)) {
    return;
  }

  const profile = runtimeProfile();
  const layer = document.createElement("div");
  layer.className = particleLayerClass;
  layer.dataset.particleContext = profile.context;
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);

  const particles = createParticles(layer, particleCount(profile), profile.context);
  const pointer: PointerState = {
    x: Number.NaN,
    y: Number.NaN,
    forceScale: 1,
    radiusScale: 1,
    startedAt: 0,
    durationMs: 0
  };
  let animationId = 0;
  let lastFrameTime = 0;
  let running = true;
  const frame = (time: number) => {
    animationId = 0;

    if (!running) {
      return;
    }

    if (!document.body.contains(layer)) {
      running = false;
      animationId = 0;
      return;
    }

    const elapsedMs = lastFrameTime === 0 ? profile.frameMs : Math.min(96, Math.max(1, time - lastFrameTime));
    lastFrameTime = time;
    animateParticles(
      particles,
      pointer,
      time,
      elapsedMs / profile.frameMs,
      elapsedMs / pointerFrameMs(profile, pointer)
    );
    animationId = window.requestAnimationFrame(frame);
  };
  const start = () => {
    if (animationId === 0) {
      running = true;
      lastFrameTime = 0;
      animationId = window.requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    running = false;
    if (animationId !== 0) {
      window.cancelAnimationFrame(animationId);
      animationId = 0;
    }
    lastFrameTime = 0;
  };

  start();

  const reset = () => {
    for (const particle of particles) {
      resetParticle(particle, true);
    }
  };

  window.addEventListener("resize", reset, { passive: true });
  window.addEventListener("orientationchange", reset, { passive: true });
  if (profile.pointerEnabled) {
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.forceScale = 1;
        pointer.radiusScale = 1;
        pointer.startedAt = 0;
        pointer.durationMs = 0;
      },
      { passive: true }
    );
    window.addEventListener(
      "pointerleave",
      () => {
        pointer.x = Number.NaN;
        pointer.y = Number.NaN;
        pointer.startedAt = 0;
        pointer.durationMs = 0;
      },
      { passive: true }
    );
  }
  if (profile.tapEnabled) {
    let tapTimeout = 0;

    window.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse") {
          return;
        }

        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.forceScale = tapForceScale;
        pointer.radiusScale = tapRadiusScale;
        pointer.startedAt = performance.now();
        pointer.durationMs = tapInfluenceMs;
        window.clearTimeout(tapTimeout);
        tapTimeout = window.setTimeout(() => {
          pointer.x = Number.NaN;
          pointer.y = Number.NaN;
          pointer.forceScale = 1;
          pointer.radiusScale = 1;
          pointer.startedAt = 0;
          pointer.durationMs = 0;
        }, tapInfluenceMs);
      },
      { passive: true }
    );
  }
  window.addEventListener("beforeunload", () => {
    stop();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      start();
      return;
    }

    stop();
  });
}

function createParticles(layer: HTMLElement, count: number, context: ParticleContext): Particle[] {
  return Array.from({ length: count }, () => {
    const element = document.createElement("span");
    element.textContent = sample(config.chars);
    layer.append(element);

    const particle: Particle = {
      element,
      x: 0,
      y: 0,
      driftX: 0,
      driftY: 0,
      opacity: 0,
      phase: 0,
      speed: 0,
      context
    };

    resetParticle(particle, true);
    return particle;
  });
}

function animateParticles(
  particles: Particle[],
  pointer: PointerState,
  time: number,
  motionStep: number,
  pointerStep: number
): void {
  for (const particle of particles) {
    particle.x += particle.driftX * motionStep;
    particle.y += particle.driftY * motionStep;
    applyPointerInfluence(particle, pointer, pointerStep);
    particle.phase += particle.speed * motionStep;

    const flicker = 0.72 + Math.sin(time * 0.0017 + particle.phase) * 0.28;
    particle.element.style.opacity = (particle.opacity * flicker).toFixed(3);
    particle.element.style.transform = `translate3d(${particle.x.toFixed(2)}px, ${particle.y.toFixed(2)}px, 0)`;

    if (
      particle.y < -24 ||
      particle.y > window.innerHeight + 24 ||
      particle.x < -24 ||
      particle.x > window.innerWidth + 24
    ) {
      resetParticle(particle, false);
    }
  }
}

function resetParticle(particle: Particle, anywhere: boolean): void {
  const side = randomInt(0, 3);
  const fromEdge = !anywhere && side;
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);

  particle.x =
    fromEdge === 1
      ? width + randomBetween(4, 20)
      : fromEdge === 2
        ? -randomBetween(4, 20)
        : randomParticleX(width, particle.context);
  particle.y =
    fromEdge === 3 ? height + randomBetween(4, 20) : fromEdge ? randomBetween(0, height) : randomBetween(0, height);
  particle.driftX = randomBetween(...config.driftX);
  particle.driftY = randomBetween(...config.driftY);
  particle.opacity = randomParticleOpacity(particle.context);
  particle.phase = randomBetween(0, Math.PI * 2);
  particle.speed = randomBetween(...config.speed);
  particle.element.textContent = sample(config.chars);
}

function particleCount(profile: RuntimeProfile): number {
  const mobile = isMobileParticleViewport();
  const contextConfig = config.contexts[profile.context];
  const baseCount = mobile ? contextConfig.mobileCount : contextConfig.desktopCount;

  return Math.max(4, Math.round(baseCount * profile.countScale));
}

function particleContext(): ParticleContext {
  if (document.querySelector(".home-shell")) {
    return "home";
  }

  if (document.querySelector(".volume-wrap")) {
    return "volume";
  }

  return "article";
}

function runtimeProfile(): RuntimeProfile {
  const context = particleContext();
  const mobile = isMobileParticleViewport();
  const saveData = prefersReducedData();
  const lowPower = saveData || lowPowerDevice();
  const frameMs = frameMsByContext[context][mobile ? "mobile" : "desktop"] * (lowPower ? 1.15 : 1);
  const countScale = saveData ? 0.45 : lowPower ? 0.68 : 1;

  return {
    context,
    frameMs,
    countScale,
    pointerEnabled: !mobile && !lowPower,
    tapEnabled: mobile || lowPower
  };
}

function pointerFrameMs(profile: RuntimeProfile, pointer: PointerState): number {
  return pointerActive(pointer) ? Math.min(profile.frameMs, tapFrameMs) : profile.frameMs;
}

function pointerActive(pointer: PointerState): boolean {
  if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
    return false;
  }

  if (pointer.durationMs === 0) {
    return true;
  }

  return performance.now() - pointer.startedAt < pointer.durationMs;
}

function isMobileParticleViewport(): boolean {
  return window.matchMedia(`(max-width: ${config.mobileBreakpoint}px), (pointer: coarse)`).matches;
}

function lowPowerDevice(): boolean {
  const navigatorInfo = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = navigatorInfo.deviceMemory ?? 8;

  return cores <= 4 || memory <= 4;
}

function prefersReducedData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

function randomParticleX(width: number, context: ParticleContext): number {
  if (context === "home" || width <= config.contentSafeWidth + 120) {
    return randomBetween(0, width);
  }

  const gutter = Math.max(0, (width - config.contentSafeWidth) / 2);
  if (maybe(0.5)) {
    return randomBetween(0, Math.max(1, gutter * 0.82));
  }

  return randomBetween(Math.min(width, width - gutter * 0.82), width);
}

function randomParticleOpacity(context: ParticleContext): number {
  return randomBetween(...config.contexts[context].opacity);
}

function applyPointerInfluence(particle: Particle, pointer: PointerState, pointerStep: number): void {
  if (!pointerActive(pointer)) {
    return;
  }

  const dx = particle.x - pointer.x;
  const dy = particle.y - pointer.y;
  const distance = Math.hypot(dx, dy);
  const falloff = pointerFalloff(pointer);
  const radius = config.pointerInfluenceRadius * pointer.radiusScale * (0.72 + falloff * 0.28);

  if (distance > radius) {
    return;
  }

  const force = (1 - distance / radius) ** 2;
  const contextScale = config.contexts[particle.context].pointerScale * pointer.forceScale * falloff;
  const unitX = distance > 0 ? dx / distance : Math.cos(particle.phase);
  const unitY = distance > 0 ? dy / distance : Math.sin(particle.phase);

  particle.x += unitX * force * contextScale * 1.8 * pointerStep;
  particle.y += unitY * force * contextScale * 1.2 * pointerStep;
  particle.phase += force * contextScale * 0.08 * pointerStep;
}

function pointerFalloff(pointer: PointerState): number {
  if (pointer.durationMs === 0) {
    return 1;
  }

  const elapsed = Math.max(0, performance.now() - pointer.startedAt);
  const progress = Math.min(1, elapsed / pointer.durationMs);
  return (1 - progress) ** 1.4;
}

function sample<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)] ?? items[0];
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
