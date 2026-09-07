/** Stable IDs are also the inputs to the deterministic rotation schedule. */
export const badgeArtworkPresetIds = [
  "catsTote",
  "mizuhoCourier",
  "yamabiko",
  "bocchiPortrait",
  "nagaraNozomi",
  "bocchiBox",
  "kessokuBreak",
  "kaedePortrait",
  "kitaDuet",
  "haruhiPlane",
  "yukiReading",
  "maiReturn",
  "guitarKit",
  "sosBooks",
  "pandaSlippers",
  "shikiLedge",
  "shikiMikiyaUmbrella",
  "denjiPochitaToast",
  "powerAkiMeowy",
  "makioAsaPages",
  "asaEmiriWalk",
  "eizoukenFlight",
  "eizoukenFrame",
  "watashiOzuCycle",
  "akashiMochiguman"
] as const;

export type BadgeArtworkPresetId = (typeof badgeArtworkPresetIds)[number];
