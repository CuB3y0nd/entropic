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
};

const frameMsByContext: Record<ParticleContext, { desktop: number; mobile: number }> = {
  home: { desktop: 42, mobile: 72 },
  volume: { desktop: 56, mobile: 96 },
  article: { desktop: 90, mobile: 140 }
};

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
  const pointer = { x: Number.NaN, y: Number.NaN };
  let animationId = 0;
  let timerId = 0;
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

    animateParticles(particles, pointer, time);
    timerId = window.setTimeout(() => {
      timerId = 0;
      animationId = window.requestAnimationFrame(frame);
    }, profile.frameMs);
  };
  const start = () => {
    if (animationId === 0 && timerId === 0) {
      running = true;
      animationId = window.requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    running = false;
    if (animationId !== 0) {
      window.cancelAnimationFrame(animationId);
      animationId = 0;
    }
    if (timerId !== 0) {
      window.clearTimeout(timerId);
      timerId = 0;
    }
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
      },
      { passive: true }
    );
    window.addEventListener(
      "pointerleave",
      () => {
        pointer.x = Number.NaN;
        pointer.y = Number.NaN;
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

function animateParticles(particles: Particle[], pointer: { x: number; y: number }, time: number): void {
  for (const particle of particles) {
    particle.x += particle.driftX;
    particle.y += particle.driftY;
    applyPointerInfluence(particle, pointer);
    particle.phase += particle.speed;

    const flicker = 0.72 + Math.sin(time * 0.0017 + particle.phase) * 0.28;
    particle.element.style.opacity = (particle.opacity * flicker).toFixed(3);
    particle.element.style.transform = `translate3d(${particle.x.toFixed(1)}px, ${particle.y.toFixed(1)}px, 0)`;

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
  const frameMs = frameMsByContext[context][mobile ? "mobile" : "desktop"] * (lowPower ? 1.45 : 1);
  const countScale = saveData ? 0.45 : lowPower ? 0.68 : 1;

  return {
    context,
    frameMs,
    countScale,
    pointerEnabled: !mobile && !lowPower
  };
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

function applyPointerInfluence(particle: Particle, pointer: { x: number; y: number }): void {
  if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
    return;
  }

  const dx = particle.x - pointer.x;
  const dy = particle.y - pointer.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= 0 || distance > config.pointerInfluenceRadius) {
    return;
  }

  const force = (1 - distance / config.pointerInfluenceRadius) ** 2;
  const contextScale = config.contexts[particle.context].pointerScale;
  particle.x += (dx / distance) * force * contextScale * 1.8;
  particle.y += (dy / distance) * force * contextScale * 1.2;
  particle.phase += force * contextScale * 0.08;
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
