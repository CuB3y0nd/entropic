import type { AppearanceConfig, EffectsConfig, TextmodeConfig } from "./types/theme.ts";

export const defaultAppearance: AppearanceConfig = {
  colors: {
    background: "#0c0d10",
    homeBackground: "#0a0b11",
    foreground: "#fefefe",
    link: "#93ffd7",
    linkHover: "#c7ffe9",
    linkHoverBackground: "#153329",
    particleHome: "#b47ae2",
    particleHomeGlow: "#6f4b97",
    particlePage: "#9368b8",
    particlePageGlow: "#52376f",
    particleVolume: "#a878d2",
    particleVolumeGlow: "#68448c"
  },
  fonts: {
    asciiFamily: "gohu",
    asciiUrl: "/assets/fonts/gohu-subset.woff",
    asciiFormat: "woff"
  },
  sizing: {
    textSize: "14px",
    cjkSize: "13px",
    cjkLinkSize: "15px",
    textCell: "8px",
    homeSize: "14px"
  }
};

export const defaultEffects: EffectsConfig = {
  particles: {
    chars: [".", ".", "·", "·", ":", "'", "*"],
    mobileBreakpoint: 760,
    contentSafeWidth: 760,
    pointerInfluenceRadius: 150,
    driftX: [-0.28, 0.28],
    driftY: [-0.72, -0.2],
    phaseStep: [0.03, 0.085],
    pages: {
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
    },
    enabled: true
  },
  homeAsciiGlitch: {
    minIntervalMs: 1400,
    maxIntervalMs: 6800,
    frameMinMs: 28,
    frameMaxMs: 110,
    burstFrameMin: 2,
    burstFrameMax: 8,
    mutationRatioMin: 0.018,
    mutationRatioMax: 0.11,
    lineShiftChance: 0.52,
    enabled: true
  }
};

export const defaultTextmode: TextmodeConfig = {
  columns: 90,
  bodyWidth: 80,
  textIndent: 4,
  articleArtIndent: 60,
  volumeArtIndent: 60,
  volumeRightColumn: 83,
  mobileFitBreakpoint: 760
};

export const defaultHomeAsciiArt = `▓█████  ███▄    █ ▄▄▄█████▓ ██▀███   ▒█████   ██▓███   ██▓ ▄████▄
▓█   ▀  ██ ▀█   █ ▓  ██▒ ▓▒▓██ ▒ ██▒▒██▒  ██▒▓██░  ██▒▓██▒▒██▀ ▀█
▒███   ▓██  ▀█ ██▒▒ ▓██░ ▒░▓██ ░▄█ ▒▒██░  ██▒▓██░ ██▓▒▒██▒▒▓█    ▄
▒▓█  ▄ ▓██▒  ▐▌██▒░ ▓██▓ ░ ▒██▀▀█▄  ▒██   ██░▒██▄█▓▒ ▒░██░▒▓▓▄ ▄██▒
░▒████▒▒██░   ▓██░  ▒██▒ ░ ░██▓ ▒██▒░ ████▓▒░▒██▒ ░  ░░██░▒ ▓███▀ ░
░░ ▒░ ░░ ▒░   ▒ ▒   ▒ ░░   ░ ▒▓ ░▒▓░░ ▒░▒░▒░ ▒▓▒░ ░  ░░▓  ░ ░▒ ▒  ░
 ░ ░  ░░ ░░   ░ ▒░    ░      ░▒ ░ ▒░  ░ ▒ ▒░ ░▒ ░      ▒ ░  ░  ▒
   ░      ░   ░ ░   ░        ░░   ░ ░ ░ ░ ▒  ░░        ▒ ░░
   ░  ░         ░             ░         ░ ░            ░  ░ ░
                                                        ░`;
