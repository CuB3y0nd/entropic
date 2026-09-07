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

export type VolumeConfig = {
  readonly title: string;
  readonly subtitle?: string;
  readonly listLabel: string;
  readonly postscript?: readonly string[];
  readonly entryPrefix?: string;
  readonly entryLabel?: "index" | "year";
  readonly reverseEntryNumbers?: boolean;
  readonly phileSort?: VolumePhileSort;
};

export type CveRecord = {
  readonly id: `CVE-${number}-${number}`;
  readonly title: string;
  readonly date: string;
};
