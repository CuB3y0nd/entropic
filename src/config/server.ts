import input from "../../entropic.config.ts";
import { resolveConfig, resolveVolumeConfig } from "./resolve.ts";

/** Build-only entry. Browsers receive individual settings through escaped HTML attributes. */
export const config = resolveConfig(input);
export const siteConfig = config.site;
export const homeConfig = config.home;
export const phileConfig = config.philes;
export const cveConfig = config.cves;
export const appearanceConfig = config.theme.appearance;
export const effectsConfig = config.theme.effects;
export const textmodeConfig = config.theme.textmode;

export function volumeConfig(number: number) {
  return resolveVolumeConfig(number, config.site.name, config.volumes[number]);
}
