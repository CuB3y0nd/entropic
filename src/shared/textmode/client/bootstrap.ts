import { readParticleConfig } from "@/config/client";
import type { ParticleConfig } from "@/config/types";
import { observeAnimationActivity } from "@/shared/browser/animation-activity";
import { afterPageLoad } from "@/shared/browser/ready";
import { installTextmodeAlignment } from "./alignment";

type BootstrapOptions = {
  mobileFitBreakpoint: number;
  particles: ParticleConfig | null;
};

const idleDelayMs = 1200;
const idleTimeoutMs = 1600;

export function installTextmodeBootstrap(options = readOptions()): void {
  installMobileFit(options.mobileFitBreakpoint);
  installTextmodeAlignment(options.mobileFitBreakpoint);

  const particles = options.particles;
  if (particles?.enabled) {
    afterPageLoad(() => {
      let loadingQueued = false;
      const stopObserving = observeAnimationActivity((active) => {
        if (!active || loadingQueued) return;
        loadingQueued = true;
        runWhenIdle(() => {
          stopObserving();
          void import("../particles/install").then(({ installAsciiParticles }) => {
            installAsciiParticles(particles);
          });
        });
      });
    });
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
    void import("./fit").then(({ installTextmodeFit }) => {
      installTextmodeFit(fitMedia);
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
    particles: readParticleConfig()
  };
}

function readPositiveInteger(input: string | undefined, fallback: number): number {
  if (!input) {
    return fallback;
  }

  const value = Number.parseInt(input, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
