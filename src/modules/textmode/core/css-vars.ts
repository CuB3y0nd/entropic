import type { AppearanceConfig } from "../../../config";

export function appearanceCssVariables(config: AppearanceConfig): string {
  const variables = {
    "--bg": config.colors.background,
    "--home-bg": config.colors.homeBackground,
    "--fg": config.colors.foreground,
    "--link": config.colors.link,
    "--link-hover": config.colors.linkHover,
    "--link-hover-bg": config.colors.linkHoverBackground,
    "--particle-home": config.colors.particleHome,
    "--particle-home-glow": config.colors.particleHomeGlow,
    "--particle-page": config.colors.particlePage,
    "--particle-page-glow": config.colors.particlePageGlow,
    "--particle-volume": config.colors.particleVolume,
    "--particle-volume-glow": config.colors.particleVolumeGlow,
    "--text-font": quoteFont(config.fonts.asciiFamily),
    "--text-size": config.sizing.textSize,
    "--cjk-size": config.sizing.cjkSize,
    "--cjk-link-size": config.sizing.cjkLinkSize,
    "--text-cell": config.sizing.textCell,
    "--home-size": config.sizing.homeSize
  };

  return `${fontFace(config.fonts.asciiFamily, config.fonts.asciiUrl, config.fonts.asciiFormat)}
:root {\n${Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n")}\n}`;
}

function fontFace(family: string, url: string, format: string, unicodeRange?: string): string {
  const unicode = unicodeRange ? `\n  unicode-range: ${unicodeRange};` : "";

  return `@font-face {
  font-family: ${quoteFont(family)};
  src: url("${escapeCssString(url)}") format("${escapeCssString(format)}");
  font-display: block;
  font-style: normal;
  font-weight: 400;${unicode}
}`;
}

function escapeCssString(input: string): string {
  return input.replace(/["\\]/g, "\\$&");
}

function quoteFont(font: string): string {
  return font
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      return /^["'].*["']$/.test(trimmed) || /^[a-z-]+$/i.test(trimmed) ? trimmed : JSON.stringify(trimmed);
    })
    .join(", ");
}
