import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateBadgeLayout } from "../../src/features/site-badges/layout";
import type { BadgeArtwork } from "../../src/features/site-badges/model";

const artwork: BadgeArtwork = { source: "/art.png", displayWidthPx: 145, displayHeightPx: 148 };

test("badge panels fit five columns at most and keep odd artwork widths aligned", () => {
  assert.equal(calculateBadgeLayout(0, null).panelWidthPx, 0);
  assert.equal(calculateBadgeLayout(2, null).panelWidthPx, 184);
  assert.equal(calculateBadgeLayout(6, null).panelWidthPx, 472);
  assert.equal(calculateBadgeLayout(1, artwork).panelWidthPx, 146);
  assert.equal(calculateBadgeLayout(2, null).horizontalPanelWidthPx, 184);
});

test("side artwork overlap and companions contribute to the actual panel width", () => {
  const layout = calculateBadgeLayout(1, {
    ...artwork,
    placement: "left",
    badgeOverlapPx: 20,
    companion: { source: "/companion.png", displayWidthPx: 180, displayHeightPx: 60, placement: "bottom-right" }
  });
  assert.equal(layout.panelWidthPx, 180);
  assert.equal(layout.horizontalPanelWidthPx, 305);
});

test("invalid artwork configuration fails at build time instead of producing broken CSS", () => {
  assert.throws(() => calculateBadgeLayout(-1, null), /count/);
  assert.throws(() => calculateBadgeLayout(2, { ...artwork, displayWidthPx: 0 }), /dimensions/);
  assert.throws(() => calculateBadgeLayout(2, { ...artwork, badgeOverlapPx: Number.NaN }), /overlap/);
  assert.throws(() => calculateBadgeLayout(2, { ...artwork, placement: "left", badgeOverlapPx: 145 }), /overlap/);
});
