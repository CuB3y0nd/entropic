export type HomeItem = {
  readonly label: string;
  readonly href?: string;
  readonly linkLabel?: string;
  readonly external?: boolean;
  /** Overrides home.itemPrefix for this item. Empty string omits the marker and separator. */
  readonly prefix?: string;
};

export type HomeSection = {
  readonly title: string;
  /** Overrides home.sectionPrefix for this heading. Empty string omits the marker and separator. */
  readonly prefix?: string;
  readonly items?: readonly HomeItem[];
  readonly volumes?: {
    readonly include?: readonly number[];
    readonly exclude?: readonly number[];
    readonly sort?: "asc" | "desc";
    readonly showEmpty?: boolean;
  };
};

export type VolumePhileSort = {
  readonly by: "date" | "order";
  readonly direction: "asc" | "desc";
};

export type VolumeDecoration = "circuit" | "archive" | "study" | "prism" | "life";

export type VolumeCalendar = {
  readonly month: number;
  readonly day: number;
};

export type VolumeDecorationOptions = {
  /** Keep the illustration visible while pausing its animation. Defaults to true. */
  readonly animated?: boolean;
  /** Playback multiplier, 0.25..4. Defaults to 1. */
  readonly speed?: number;
} & (
  | { readonly kind: "study"; readonly calendar?: VolumeCalendar }
  | { readonly kind: Exclude<VolumeDecoration, "study" | "life"> }
);

export type VolumeConfig = {
  readonly title: string;
  readonly subtitle?: string;
  readonly listLabel: string;
  /** Header artwork. Defaults to life; false hides it. */
  readonly decoration: VolumeDecoration | VolumeDecorationOptions | false;
  readonly postscript?: readonly string[];
  readonly entryPrefix?: string;
  readonly entryLabel?: "index" | "year";
  readonly reverseEntryNumbers?: boolean;
  readonly phileSort?: VolumePhileSort;
};

export type ResolvedVolumeConfig = Omit<VolumeConfig, "decoration"> & {
  readonly decoration: {
    readonly kind: VolumeDecoration | false;
    readonly animated: boolean;
    readonly speed: number;
    readonly calendar: VolumeCalendar;
  };
};

export type CveRecord = {
  readonly id: `CVE-${number}-${number}`;
  readonly title: string;
};

export type ResearchRecognition = {
  /** Hide this recognition without removing its content. Defaults to true. */
  readonly enabled?: boolean;
  /** Stable slug for the local recognition anchor. */
  readonly id: string;
  /** The program's year label; a recognition cycle can span calendar years. */
  readonly year: number;
  readonly organization: string;
  readonly title: string;
  readonly recipient: string;
  readonly period: string;
  readonly href: string;
};
