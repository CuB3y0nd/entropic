export type PageProps = {
  readonly title?: string;
  readonly tabTitle?: string;
  readonly description?: string;
  readonly preloadCjk?: boolean;
  readonly pageType?: "website" | "article";
  readonly publishedTime?: Date;
  readonly lang?: "en" | "zh";
};
