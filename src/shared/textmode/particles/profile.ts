import type { ParticleConfig, ParticlePageKind } from "@/config/types";

const motionReferenceMs: Record<ParticlePageKind, { desktop: number; mobile: number }> = {
  home: { desktop: 42, mobile: 50 },
  volume: { desktop: 52, mobile: 66 },
  article: { desktop: 78, mobile: 88 }
};

export type ParticleProfile = {
  readonly pageKind: ParticlePageKind;
  readonly count: number;
  readonly motionReferenceMs: number;
  readonly minimumFrameIntervalMs: number;
  readonly trackHover: boolean;
};

export function readParticleProfile(config: ParticleConfig, pageKind: ParticlePageKind): ParticleProfile {
  const mobile = window.matchMedia(`(max-width: ${config.mobileBreakpoint}px), (pointer: coarse)`).matches;
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const saveData = device.connection?.saveData === true;
  const lowPower = saveData || (device.hardwareConcurrency ?? 8) <= 4 || (device.deviceMemory ?? 8) <= 4;
  const countScale = saveData ? 0.45 : lowPower ? 0.68 : 1;
  const pageConfig = config.pages[pageKind];

  return {
    pageKind,
    count: Math.max(0, Math.round((mobile ? pageConfig.mobileCount : pageConfig.desktopCount) * countScale)),
    motionReferenceMs: motionReferenceMs[pageKind][mobile ? "mobile" : "desktop"] * (lowPower ? 1.15 : 1),
    minimumFrameIntervalMs: 1000 / (mobile || lowPower ? 30 : 60),
    trackHover: !mobile && !lowPower
  };
}

export function detectParticlePageKind(): ParticlePageKind {
  if (document.querySelector(".home-shell")) return "home";
  if (document.querySelector(".volume-wrap")) return "volume";
  return "article";
}
