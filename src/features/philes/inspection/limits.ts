/** Shared work bounds for selection capture, parsing and numeric representations. */
export const INSPECTION_LIMITS = {
  selectionLength: 2048,
  expressionLength: 512,
  byteCount: 32,
  tokenCount: 128,
  depth: 32,
  integerBits: 256
} as const;
