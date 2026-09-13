export type MovingRect = {
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: boolean;
};

/** Native Gohu text, positioned in the frame's 23 x 15 inner character cells. */
export type ArtLabel = {
  column: number;
  row: number;
  text: string;
  tone: "ink" | "muted" | "accent";
};

export type AlgorithmFrame = {
  ink: string;
  accent: string;
  trail?: string;
  motion?: readonly MovingRect[];
  bars?: { values: readonly number[]; active: number };
  labels?: readonly ArtLabel[];
};
export type Algorithm = { intervalMs: number; next: () => AlgorithmFrame };
export type Random = () => number;
