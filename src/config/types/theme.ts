export type AppearanceConfig = {
  readonly colors: {
    readonly background: string;
    readonly homeBackground: string;
    readonly foreground: string;
    readonly link: string;
    readonly linkHover: string;
    readonly linkHoverBackground: string;
    readonly particleHome: string;
    readonly particleHomeGlow: string;
    readonly particlePage: string;
    readonly particlePageGlow: string;
    readonly particleVolume: string;
    readonly particleVolumeGlow: string;
  };
  readonly fonts: {
    readonly asciiFamily: string;
    readonly asciiUrl: string;
    readonly asciiFormat: string;
  };
  readonly sizing: {
    readonly textSize: string;
    readonly cjkSize: string;
    readonly cjkLinkSize: string;
    readonly textCell: string;
    readonly homeSize: string;
  };
};

export type ParticlePageKind = "home" | "volume" | "article";

export type ParticlePageConfig = {
  readonly desktopCount: number;
  readonly mobileCount: number;
  readonly opacity: readonly [number, number];
  readonly pointerScale: number;
};

export type ParticleConfig = {
  readonly enabled: boolean;
  readonly chars: readonly [string, ...string[]];
  readonly mobileBreakpoint: number;
  readonly contentSafeWidth: number;
  readonly pointerInfluenceRadius: number;
  readonly driftX: readonly [number, number];
  readonly driftY: readonly [number, number];
  readonly phaseStep: readonly [number, number];
  readonly pages: Readonly<Record<ParticlePageKind, ParticlePageConfig>>;
};

export type HomeAsciiGlitchConfig = {
  readonly enabled: boolean;
  readonly minIntervalMs: number;
  readonly maxIntervalMs: number;
  readonly frameMinMs: number;
  readonly frameMaxMs: number;
  readonly burstFrameMin: number;
  readonly burstFrameMax: number;
  readonly mutationRatioMin: number;
  readonly mutationRatioMax: number;
  readonly lineShiftChance: number;
};

export type EffectsConfig = {
  readonly particles: ParticleConfig;
  readonly homeAsciiGlitch: HomeAsciiGlitchConfig;
};

export type TextmodeConfig = {
  readonly columns: number;
  readonly bodyWidth: number;
  readonly textIndent: number;
  readonly articleArtIndent: number;
  readonly volumeArtIndent: number;
  readonly volumeRightColumn: number;
  readonly mobileFitBreakpoint: number;
};
