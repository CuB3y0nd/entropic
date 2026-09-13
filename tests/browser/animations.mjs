import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, settleTextLayout, stubExternalResources } from "./support.mjs";

const browser = await launchBrowser();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await stubExternalResources(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl.href);
  await settleTextLayout(page);
  assert.equal(await page.locator(".ascii-particles").count(), 0, "Reduced motion starts without particle DOM");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const particle = page.locator(".ascii-particles span").first();
  await particle.waitFor();
  const desktopCount = await page.locator(".ascii-particles span").count();
  const movingStyle = await particle.getAttribute("style");
  await page.waitForFunction(
    (previous) => document.querySelector(".ascii-particles span")?.getAttribute("style") !== previous,
    movingStyle
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector(".ascii-particles")?.hidden);
  const pausedStyle = await particle.getAttribute("style");
  await page.waitForTimeout(300);
  assert.equal(await particle.getAttribute("style"), pausedStyle, "Live reduced motion stops rendering");
  assert.equal(await page.locator(".ascii-hero.is-glitching").count(), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(
    (previous) => document.querySelector(".ascii-particles span")?.getAttribute("style") !== previous,
    pausedStyle
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    (count) => document.querySelectorAll(".ascii-particles span").length < count,
    desktopCount
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(
    (count) => document.querySelectorAll(".ascii-particles span").length === count,
    desktopCount
  );

  // Exercise the page lifecycle used by back/forward cache without depending
  // on whether this particular browser run elects to cache the document.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  const hiddenStyle = await particle.getAttribute("style");
  await page.waitForTimeout(300);
  assert.equal(await particle.getAttribute("style"), hiddenStyle);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await page.waitForFunction(
    (previous) => document.querySelector(".ascii-particles span")?.getAttribute("style") !== previous,
    hiddenStyle
  );
  console.log(`PASS ${browserName}: live motion preferences, responsive particle counts, page hide/show`);

  await page.goto(new URL("/volume/1/rce-sapido_rb-1732/", baseUrl).href);
  await page.locator(".life-grid").waitFor();
  await settleTextLayout(page);
  const readLifeOffset = () =>
    page.evaluate(() => {
      const grid = document.querySelector(".life-grid").getBoundingClientRect();
      const frame = document.querySelector("[data-life-line]").getBoundingClientRect();
      return { left: grid.left - frame.left, top: grid.top - frame.top };
    });
  const initialOffset = await readLifeOffset();
  await page.setViewportSize({ width: 390, height: 800 });
  await settleTextLayout(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await settleTextLayout(page);
  const restoredOffset = await readLifeOffset();
  assert.ok(
    Math.abs(initialOffset.left - restoredOffset.left) < 1,
    "Life stays in its frame after returning to desktop"
  );
  assert.ok(Math.abs(initialOffset.top - restoredOffset.top) < 1);

  await page.evaluate(() => {
    window.lifeMutations = 0;
    new MutationObserver((records) => {
      window.lifeMutations += records.length;
    }).observe(document.querySelector(".life-grid"), { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.waitForFunction(() => window.lifeMutations > 0);
  await page.setViewportSize({ width: 1280, height: 100 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector(".life-grid").getBoundingClientRect().bottom <= 0);
  await page.waitForTimeout(100);
  const offscreenMutations = await page.evaluate(() => window.lifeMutations);
  await page.waitForTimeout(550);
  assert.equal(
    await page.evaluate(() => window.lifeMutations),
    offscreenMutations,
    "Offscreen Life stops calculating generations"
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction((count) => window.lifeMutations > count, offscreenMutations);
  console.log(`PASS ${browserName}: Life desktop/mobile/desktop alignment and offscreen pause/resume`);
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
