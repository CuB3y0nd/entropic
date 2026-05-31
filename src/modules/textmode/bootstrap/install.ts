type BootstrapOptions = {
  mobileFitBreakpoint: number;
  particlesEnabled: boolean;
};

const idleDelayMs = 1200;
const idleTimeoutMs = 1600;

export function installTextmodeBootstrap(options = readOptions()): void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  installMobileFit(options.mobileFitBreakpoint);

  if (options.particlesEnabled && !reducedMotion) {
    window.addEventListener(
      "load",
      () => {
        runWhenIdle(() => {
          void import("../particles/install").then(({ installAsciiParticles }) => {
            installAsciiParticles();
          });
        });
      },
      { once: true, passive: true }
    );
  }
}

function installMobileFit(mobileFitBreakpoint: number): void {
  const fitMedia = window.matchMedia(`(max-width: ${mobileFitBreakpoint}px)`);
  let fitLoaded = false;

  const loadFit = () => {
    if (!fitMedia.matches || fitLoaded) {
      return;
    }

    fitLoaded = true;
    void import("../fit/install").then(({ installTextmodeFit }) => {
      installTextmodeFit();
    });
  };

  loadFit();
  fitMedia.addEventListener("change", loadFit, { passive: true });
}

function runWhenIdle(callback: () => void): void {
  window.setTimeout(() => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(callback, { timeout: idleTimeoutMs });
      return;
    }

    callback();
  }, idleDelayMs);
}

function readOptions(): BootstrapOptions {
  const dataset = document.body.dataset;

  return {
    mobileFitBreakpoint: readPositiveInteger(dataset.mobileFitBreakpoint, 760),
    particlesEnabled: dataset.particlesEnabled === "true"
  };
}

function readPositiveInteger(input: string | undefined, fallback: number): number {
  if (!input) {
    return fallback;
  }

  const value = Number.parseInt(input, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
