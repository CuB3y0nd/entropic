import { badgeArtworkPresetIds, calculateBadgeLayout, validateArtworkRotation } from "../features/site-badges/index.ts";
import { appearanceCssVariables } from "../shared/textmode/core/css-vars.ts";
import { safeUrl } from "../shared/urls.ts";
import type { ResolvedConfig } from "./resolve.ts";
import type { ArtworkSelection } from "./types.ts";

/** TypeScript checks shapes; this boundary checks values and relationships. */
export function validateConfig(config: ResolvedConfig): void {
  at("site.url", () => {
    const url = new URL(config.site.url);
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("Use an absolute HTTP(S) origin without credentials, a subpath, query, or fragment.");
    }
  });
  nonEmpty(config.site.name, "site.name");
  nonEmpty(config.site.description, "site.description");
  const socialImage = config.site.socialImage;
  if (socialImage) {
    at("site.socialImage.src", () => {
      safeUrl(socialImage.src, "image");
      if (!/^(?:\/(?!\/)|https?:\/\/)/i.test(socialImage.src) || socialImage.src.trim() !== socialImage.src) {
        throw new Error("Use a path from public/ starting with /, or an absolute HTTP(S) URL.");
      }
      const url = new URL(socialImage.src, config.site.url);
      if (url.username || url.password || url.hash) {
        throw new Error("Sharing image URLs must not contain credentials or a fragment.");
      }
    });
    nonEmpty(socialImage.alt, "site.socialImage.alt");
    if (socialImage.type !== undefined && !/^image\/[a-z0-9.+-]+$/i.test(socialImage.type)) {
      fail("site.socialImage.type", "Use an image MIME type such as image/jpeg, or omit it if unknown.");
    }
    integer(socialImage.width, "site.socialImage.width", 1);
    integer(socialImage.height, "site.socialImage.height", 1);
  }
  singleLinePrefix(config.home.sectionPrefix, "home.sectionPrefix");
  singleLinePrefix(config.home.itemPrefix, "home.itemPrefix");
  nonEmpty(config.home.asciiArt, "home.asciiArt");
  config.home.sections.forEach((section, sectionIndex) => {
    const field = `home.sections[${sectionIndex}]`;
    nonEmpty(section.title, `${field}.title`);
    if (section.prefix !== undefined) singleLinePrefix(section.prefix, `${field}.prefix`);
    section.items?.forEach((item, itemIndex) => {
      if (item.href) at(`${field}.items[${itemIndex}].href`, () => safeUrl(item.href ?? ""));
      if (item.prefix !== undefined) singleLinePrefix(item.prefix, `${field}.items[${itemIndex}].prefix`);
    });
    for (const filter of ["include", "exclude"] as const) {
      for (const number of section.volumes?.[filter] ?? []) integer(number, `${field}.volumes.${filter}`, 0);
    }
  });
  for (const number of Object.keys(config.volumes)) {
    if (!/^(0|[1-9]\d*)$/.test(number)) fail(`volumes.${number}`, "Use a non-negative volume number as the key.");
    integer(Number(number), `volumes.${number}`, 0);
  }
  const cveIds = new Set<string>();
  config.cves.records.forEach((record, index) => {
    const field = `cves.records[${index}]`;
    if (!/^CVE-\d{4}-\d{4,}$/.test(record.id) || cveIds.has(record.id)) fail(`${field}.id`, "Use a unique CVE ID.");
    cveIds.add(record.id);
    const date = new Date(`${record.date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== record.date
    ) {
      fail(`${field}.date`, "Use a real calendar date in YYYY-MM-DD format.");
    }
  });
  config.buttons.items.forEach((badge, index) => {
    const field = `buttons.items[${index}]`;
    nonEmpty(badge.label, `${field}.label`);
    if ((badge.href !== undefined) === (badge.copyText !== undefined)) {
      fail(field, "Provide exactly one action: href (link) or copyText (clipboard text).");
    }
    if (badge.href !== undefined) at(`${field}.href`, () => safeUrl(badge.href ?? ""));
    if (badge.copyText !== undefined) nonEmpty(badge.copyText, `${field}.copyText`);
    at(`${field}.imageSrc`, () => safeUrl(badge.imageSrc, "image"));
  });
  validateArtwork(config.buttons.artwork);
  at("theme.appearance", () => appearanceCssVariables(config.theme.appearance));

  const grid = config.theme.textmode;
  for (const [key, value] of Object.entries(grid))
    integer(value, `theme.textmode.${key}`, key.endsWith("Indent") ? 0 : 1, 10000);
  if (grid.bodyWidth + grid.textIndent > grid.columns)
    fail("theme.textmode.bodyWidth", "Article width plus textIndent must fit within columns.");
  if (
    grid.volumeArtIndent < 3 ||
    grid.volumeRightColumn <= grid.volumeArtIndent ||
    grid.volumeRightColumn >= grid.columns
  ) {
    fail("theme.textmode.volumeRightColumn", "Require 3 <= volumeArtIndent < volumeRightColumn < columns.");
  }
  if (grid.articleArtIndent >= grid.columns) fail("theme.textmode.articleArtIndent", "Must be smaller than columns.");

  const particles = config.theme.effects.particles;
  const particleField = "theme.effects.particles";
  if (particles.chars.length === 0 || particles.chars.some((char) => !char || /\s/u.test(char)))
    fail(`${particleField}.chars`, "Provide at least one non-whitespace character.");
  for (const key of ["mobileBreakpoint", "contentSafeWidth", "pointerInfluenceRadius"] as const)
    integer(particles[key], `${particleField}.${key}`, 1, 10000);
  for (const key of ["driftX", "driftY", "phaseStep"] as const) range(particles[key], `${particleField}.${key}`);
  for (const [page, values] of Object.entries(particles.pages)) {
    for (const key of ["desktopCount", "mobileCount"] as const)
      integer(values[key], `${particleField}.pages.${page}.${key}`, 0, 1000);
    range(values.opacity, `${particleField}.pages.${page}.opacity`, 0, 1);
    bounded(values.pointerScale, `${particleField}.pages.${page}.pointerScale`, 0, 100);
  }
  const glitch = config.theme.effects.homeAsciiGlitch;
  const glitchField = "theme.effects.homeAsciiGlitch";
  range([glitch.minIntervalMs, glitch.maxIntervalMs], `${glitchField}.minIntervalMs/maxIntervalMs`, 1);
  range([glitch.frameMinMs, glitch.frameMaxMs], `${glitchField}.frameMinMs/frameMaxMs`, 1);
  range([glitch.burstFrameMin, glitch.burstFrameMax], `${glitchField}.burstFrameMin/burstFrameMax`, 1, 1000);
  integer(glitch.burstFrameMin, `${glitchField}.burstFrameMin`, 1, 1000);
  integer(glitch.burstFrameMax, `${glitchField}.burstFrameMax`, 1, 1000);
  range([glitch.mutationRatioMin, glitch.mutationRatioMax], `${glitchField}.mutationRatioMin/mutationRatioMax`, 0, 1);
  bounded(glitch.lineShiftChance, `${glitchField}.lineShiftChance`, 0, 1);
  if (config.wkd.enabled) {
    nonEmpty(config.wkd.email, "wkd.email");
    nonEmpty(config.wkd.publicKeyPath, "wkd.publicKeyPath");
    if (/^(?:[a-z]:|\/|\\)/i.test(config.wkd.publicKeyPath) || config.wkd.publicKeyPath.split(/[\\/]/).includes("..")) {
      fail("wkd.publicKeyPath", "Use a repository-relative public key path.");
    }
  }
}

function validateArtwork(selection: ArtworkSelection): void {
  if (!selection) return;
  const field = "buttons.artwork";
  const preset = (id: string, path: string) => {
    if (!badgeArtworkPresetIds.some((known) => known === id)) fail(path, `Unknown preset ${JSON.stringify(id)}.`);
  };
  if (selection.mode === "fixed") {
    preset(selection.preset, `${field}.preset`);
    return;
  }
  if (selection.mode === "custom") {
    at(`${field}.artwork`, () => calculateBadgeLayout(1, selection.artwork));
    at(`${field}.artwork.source`, () => safeUrl(selection.artwork.source, "image"));
    if (selection.artwork.companion)
      at(`${field}.artwork.companion.source`, () => safeUrl(selection.artwork.companion?.source ?? "", "image"));
    return;
  }
  at(field, () =>
    validateArtworkRotation(
      selection.mode === "visit" ? selection : { ...selection, seed: selection.seed ?? "entropic-artwork-v1" }
    )
  );
  if (selection.fallback !== undefined && selection.fallback !== null) preset(selection.fallback, `${field}.fallback`);
  if (selection.presets) {
    if (selection.presets.length === 0 || new Set(selection.presets).size !== selection.presets.length)
      fail(`${field}.presets`, "Provide a non-empty list of unique presets, or omit it to use all presets.");
    for (const id of selection.presets) preset(id, `${field}.presets`);
  }
}

function integer(value: number, field: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): void {
  bounded(value, field, minimum, maximum);
  if (!Number.isSafeInteger(value)) fail(field, "Must be an integer.");
}

function bounded(value: number, field: string, minimum: number, maximum = Number.MAX_VALUE): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum)
    fail(field, `Must be finite and between ${minimum} and ${maximum}.`);
}

function range(
  values: readonly [number, number],
  field: string,
  minimum = -Number.MAX_VALUE,
  maximum = Number.MAX_VALUE
): void {
  if (values.length !== 2) fail(field, "Use a [minimum, maximum] pair.");
  for (const value of values) bounded(value, field, minimum, maximum);
  if (values[0] > values[1]) fail(field, "The minimum must not exceed the maximum.");
}

function singleLinePrefix(value: string, field: string): void {
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value)) {
    fail(field, "Use a single-line prefix without tabs or control characters.");
  }
}

function nonEmpty(value: string, field: string): void {
  if (!value.trim()) fail(field, "Must not be empty.");
}

function at(field: string, action: () => unknown): void {
  try {
    action();
  } catch (error) {
    fail(field, error instanceof Error ? error.message : String(error));
  }
}

function fail(field: string, message: string): never {
  throw new Error(`entropic.config.ts → ${field}: ${message}`);
}
