import { cvePagePath } from "../features/cves/index.ts";
import { defaultAppearance, defaultEffects, defaultHomeAsciiArt, defaultTextmode } from "./defaults.ts";
import type { EntropicConfig, HomeSection, VolumeConfig } from "./types.ts";
import { validateConfig } from "./validate.ts";

/** Resolve nested groups explicitly; undefined inherits and arrays replace whole lists. */
export function resolveConfig(input: EntropicConfig) {
  const appearance = input.theme?.appearance;
  const particles = input.theme?.effects?.particles;
  const glitch = input.theme?.effects?.homeAsciiGlitch;
  const { pages: pageOverrides, ...particleOverrides } = particles || {};
  const config = {
    site: input.site,
    home: {
      sectionPrefix: input.home?.sectionPrefix ?? "~",
      itemPrefix: input.home?.itemPrefix ?? "-",
      asciiArt: input.home?.asciiArt ?? defaultHomeAsciiArt,
      sections: input.home?.sections ?? []
    },
    volumes: input.volumes ?? {},
    cves: { enabled: input.cves?.enabled ?? false, records: input.cves?.records ?? [] },
    buttons: {
      shuffleOnBuild: input.buttons?.shuffleOnBuild ?? true,
      items: input.buttons?.items ?? [],
      artwork: input.buttons?.artwork ?? false
    },
    theme: {
      appearance: {
        colors: mergeDefined(defaultAppearance.colors, appearance?.colors),
        fonts: mergeDefined(defaultAppearance.fonts, appearance?.fonts),
        sizing: mergeDefined(defaultAppearance.sizing, appearance?.sizing)
      },
      textmode: mergeDefined(defaultTextmode, input.theme?.textmode),
      effects: {
        particles: {
          ...mergeDefined(defaultEffects.particles, particleOverrides),
          enabled: particles !== false,
          pages: {
            home: mergeDefined(defaultEffects.particles.pages.home, pageOverrides?.home),
            volume: mergeDefined(defaultEffects.particles.pages.volume, pageOverrides?.volume),
            article: mergeDefined(defaultEffects.particles.pages.article, pageOverrides?.article)
          }
        },
        homeAsciiGlitch: {
          ...mergeDefined(defaultEffects.homeAsciiGlitch, glitch || undefined),
          enabled: glitch !== false
        }
      }
    },
    analytics: input.analytics ?? false,
    wkd: input.wkd ?? { enabled: false }
  } as const;
  validateConfig(config);
  return {
    ...config,
    home: {
      ...config.home,
      sections: config.cves.enabled ? config.home.sections : withoutCveLinks(config.home.sections, config.site.url)
    }
  } as const;
}

export type ResolvedConfig = ReturnType<typeof resolveConfig>;

/** A shallow override: nested groups are handled by their owning resolver. */
function mergeDefined<T extends object>(defaults: T, overrides?: Partial<T>): T {
  const merged = { ...defaults };
  if (overrides) {
    for (const key in overrides) {
      if (!Object.hasOwn(overrides, key)) continue;
      const value = overrides[key];
      if (value !== undefined) merged[key] = value;
    }
  }
  return merged;
}

function withoutCveLinks(sections: readonly HomeSection[], siteUrl: string): readonly HomeSection[] {
  const origin = new URL(siteUrl).origin;
  return sections.flatMap((section) => {
    if (!section.items) return [section];
    const items = section.items.filter((item) => {
      if (!item.href) return true;
      const target = new URL(item.href, siteUrl);
      return target.origin !== origin || `${target.pathname.replace(/\/+$/, "")}/` !== cvePagePath;
    });
    // A section containing only the disabled page's links should not leave an empty heading.
    if (section.items.length > 0 && items.length === 0 && !section.volumes) return [];
    return [{ ...section, items }];
  });
}

export function resolveVolumeConfig(
  number: number,
  siteName: string,
  override: Partial<VolumeConfig> = {}
): VolumeConfig {
  return mergeDefined<VolumeConfig>(
    {
      title: `${siteName} Volume ${number}`,
      listLabel: `Volume ${number}`,
      phileSort: { by: "date", direction: "desc" },
      postscript: ["  ──[ EOF ]──────────────────────────────────────────────────────────────────//───"]
    },
    override
  );
}
