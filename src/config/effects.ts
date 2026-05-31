export type ParticleContext = "home" | "volume" | "article";

export type ParticleContextConfig = {
  desktopCount: number;
  mobileCount: number;
  opacity: [number, number];
  pointerScale: number;
};

export type ParticleConfig = {
  enable: boolean;
  chars: string[];
  mobileBreakpoint: number;
  contentSafeWidth: number;
  pointerInfluenceRadius: number;
  driftX: [number, number];
  driftY: [number, number];
  speed: [number, number];
  contexts: Record<ParticleContext, ParticleContextConfig>;
};

export type HomeAsciiGlitchConfig = {
  enable: boolean;
  minIntervalMs: number;
  maxIntervalMs: number;
  frameMinMs: number;
  frameMaxMs: number;
  burstFrameMin: number;
  burstFrameMax: number;
  mutationRatioMin: number;
  mutationRatioMax: number;
  lineShiftChance: number;
};

export type EffectsConfig = {
  particles: ParticleConfig;
  homeAsciiGlitch: HomeAsciiGlitchConfig;
};

export const effectsConfig: EffectsConfig = {
  particles: {
    enable: true,
    chars: [".", ".", "·", "·", ":", "'", "*"],
    mobileBreakpoint: 760,
    contentSafeWidth: 760,
    pointerInfluenceRadius: 150,
    driftX: [-0.28, 0.28],
    driftY: [-0.72, -0.2],
    speed: [0.03, 0.085],
    contexts: {
      home: {
        desktopCount: 86,
        mobileCount: 38,
        opacity: [0.3, 0.62],
        pointerScale: 1
      },
      volume: {
        desktopCount: 38,
        mobileCount: 18,
        opacity: [0.2, 0.44],
        pointerScale: 0.72
      },
      article: {
        desktopCount: 22,
        mobileCount: 14,
        opacity: [0.12, 0.28],
        pointerScale: 0.45
      }
    }
  },
  homeAsciiGlitch: {
    enable: true,
    minIntervalMs: 1400,
    maxIntervalMs: 6800,
    frameMinMs: 28,
    frameMaxMs: 110,
    burstFrameMin: 2,
    burstFrameMax: 8,
    mutationRatioMin: 0.018,
    mutationRatioMax: 0.11,
    lineShiftChance: 0.52
  }
};
