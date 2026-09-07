import assert from "node:assert/strict";
import { test } from "node:test";
import { validateArtworkRotation } from "../../src/features/site-badges/artwork/rotation";

test("scheduled artwork requires explicit, valid clock and seed settings", () => {
  assert.doesNotThrow(() => validateArtworkRotation({ mode: "daily", timeZone: "Asia/Shanghai", seed: "theme" }));
  assert.throws(() => validateArtworkRotation({ mode: "daily", timeZone: "invalid/zone", seed: "theme" }), RangeError);
  assert.throws(() => validateArtworkRotation({ mode: "daily", timeZone: "", seed: "theme" }), /time zone/);
  assert.throws(() => validateArtworkRotation({ mode: "daily", timeZone: "UTC", seed: " " }), /seed/);
  assert.throws(() => validateArtworkRotation({ mode: "interval", hours: 0, seed: "theme" }), /hours/);
  assert.throws(() => validateArtworkRotation({ mode: "interval", hours: Number.NaN, seed: "theme" }), /hours/);
  assert.doesNotThrow(() => validateArtworkRotation({ mode: "interval", hours: 6, seed: "theme" }));
  assert.doesNotThrow(() => validateArtworkRotation({ mode: "visit" }));
});
