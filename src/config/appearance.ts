export type AppearanceConfig = {
  colors: {
    background: string;
    homeBackground: string;
    foreground: string;
    link: string;
    linkHover: string;
    linkHoverBackground: string;
    particleHome: string;
    particleHomeGlow: string;
    particlePage: string;
    particlePageGlow: string;
    particleVolume: string;
    particleVolumeGlow: string;
  };
  fonts: {
    asciiFamily: string;
    asciiUrl: string;
    asciiFormat: string;
  };
  sizing: {
    textSize: string;
    cjkSize: string;
    cjkLinkSize: string;
    textCell: string;
    homeSize: string;
  };
};

export const appearanceConfig: AppearanceConfig = {
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
    asciiUrl: "/fonts/gohu-subset.woff",
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
