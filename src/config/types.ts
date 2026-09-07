import type { BadgeArtwork, BadgeArtworkPresetId, SiteBadge } from "../features/site-badges/index.ts";
import type { CveRecord, HomeSection, VolumeConfig } from "./types/content.ts";
import type {
  AppearanceConfig,
  HomeAsciiGlitchConfig,
  ParticleConfig,
  ParticlePageConfig,
  ParticlePageKind,
  TextmodeConfig
} from "./types/theme.ts";

export type { CveRecord, HomeItem, HomeSection, VolumeConfig, VolumePhileSort } from "./types/content.ts";
export type {
  AppearanceConfig,
  EffectsConfig,
  HomeAsciiGlitchConfig,
  ParticleConfig,
  ParticlePageConfig,
  ParticlePageKind,
  TextmodeConfig
} from "./types/theme.ts";

type ArtworkRotationOptions = {
  /** Omit to rotate through every built-in preset. Must not be empty. */
  readonly presets?: readonly BadgeArtworkPresetId[];
  /** Used when JavaScript is disabled. Defaults to nagaraNozomi; null hides the artwork. */
  readonly fallback?: BadgeArtworkPresetId | null;
};

type CustomArtwork = Omit<BadgeArtwork, "source" | "companion"> & {
  /** A /public-path or an HTTPS URL; image imports belong to internal presets. */
  readonly source: string;
  readonly companion?: Omit<NonNullable<BadgeArtwork["companion"]>, "source"> & { readonly source: string };
};

export type ArtworkSelection =
  | false
  | { readonly mode: "fixed"; readonly preset: BadgeArtworkPresetId }
  | { readonly mode: "custom"; readonly artwork: CustomArtwork }
  | (ArtworkRotationOptions &
      (
        | { readonly mode: "daily"; readonly timeZone: string; readonly seed?: string }
        | { readonly mode: "interval"; readonly hours: number; readonly seed?: string }
        | { readonly mode: "visit" }
      ));

type AppearanceOverrides = {
  readonly [Group in keyof AppearanceConfig]?: Partial<AppearanceConfig[Group]>;
};

type ParticleOverrides = Partial<Omit<ParticleConfig, "enabled" | "pages">> & {
  readonly pages?: { readonly [Page in ParticlePageKind]?: Partial<ParticlePageConfig> };
};

type WkdSettings = {
  readonly email: string;
  /** Repository-relative public key export, never a private key. */
  readonly publicKeyPath: string;
};

export type WkdConfig =
  | ({ readonly enabled: true } & WkdSettings)
  | ({ readonly enabled: false } & Partial<WkdSettings>);

/** Optional fields set to undefined inherit defaults just like omitted fields. */
export type EntropicConfig = {
  readonly site: {
    /** Absolute HTTP(S) origin, for example https://example.org/. */
    readonly url: string;
    readonly name: string;
    readonly description: string;
    /** Site-wide sharing image; omit when no image is available. */
    readonly socialImage?: {
      /** A path from public/ starting with /, or an absolute HTTP(S) URL. */
      readonly src: string;
      /** The meaningful information in the image, for assistive technology. */
      readonly alt: string;
      /** Actual image MIME type, such as image/jpeg; omit if unknown. */
      readonly type?: string;
      /** Intrinsic image dimensions in pixels. */
      readonly width: number;
      readonly height: number;
    };
  };
  readonly home?: {
    /** Default section heading prefix. Empty string omits the marker and separator. */
    readonly sectionPrefix?: string;
    /** Default item prefix, including generated volume links. Empty string omits the marker and separator. */
    readonly itemPrefix?: string;
    /** Multiline text; undefined or omission keeps the built-in Entropic banner. */
    readonly asciiArt?: string;
    /** Display order follows this array. */
    readonly sections?: readonly HomeSection[];
  };
  /** Keys are non-negative volume numbers, not titles or routes. */
  readonly volumes?: Readonly<Record<number, Partial<VolumeConfig>>>;
  readonly cves?: {
    /** Controls the CVE route, its home links, and its sitemap entry. */
    readonly enabled: boolean;
    /** Records can be retained while the page is disabled. */
    readonly records?: readonly CveRecord[];
  };
  readonly buttons?: {
    /** Shuffle once per production build. Defaults to true; development keeps items order. */
    readonly shuffleOnBuild?: boolean;
    /** 88x31 links or copy actions. This order is used without shuffling; [] hides the entire panel. */
    readonly items: readonly SiteBadge[];
    /** Omit or use false for buttons alone. */
    readonly artwork?: ArtworkSelection;
  };
  readonly theme?: {
    readonly appearance?: AppearanceOverrides;
    /** Fixed text-grid geometry; changing it can require artwork/font adjustments. */
    readonly textmode?: Partial<TextmodeConfig>;
    readonly effects?: {
      /** false disables; an object overrides only the supplied particle settings. */
      readonly particles?: false | ParticleOverrides;
      /** false disables; an object overrides only the supplied glitch settings. */
      readonly homeAsciiGlitch?: false | Partial<Omit<HomeAsciiGlitchConfig, "enabled">>;
    };
  };
  /** Vercel Web Analytics. Defaults to false for new sites. */
  readonly analytics?: boolean;
  /** Optional public key discovery. These are public publishing settings, not secrets. */
  readonly wkd?: WkdConfig;
};
