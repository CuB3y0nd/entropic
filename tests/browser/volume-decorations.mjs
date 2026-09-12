import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, settleTextLayout } from "./support.mjs";

const browser = await launchBrowser();
const errors = [];
const themes = ["circuit", "archive", "study", "prism"];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));

  for (const [number, theme] of themes.entries()) {
    await page.goto(new URL(`/volume/${number}/`, baseUrl).href);
    // Let the page finish its lazy startup before a later navigation can cancel imports.
    await page.locator(".ascii-particles span").first().waitFor({ state: "attached" });
    await settleTextLayout(page);
    const artwork = page.locator("[data-volume-decoration]");
    assert.equal(await artwork.getAttribute("data-volume-decoration"), theme);
    assert.equal(await artwork.getAttribute("aria-hidden"), "true");
    await page.waitForFunction(() => document.querySelector("[data-volume-decoration]").hasAttribute("data-active"));
    const animation = () =>
      page.evaluate(() =>
        document
          .querySelector("[data-volume-decoration]")
          .getAnimations({ subtree: true })
          .map((item) => ({
            time: item.currentTime,
            state: item.playState
          }))
      );
    assert.ok(
      (await animation()).some(({ state }) => state === "running"),
      `${theme}: visible motion`
    );
    if (theme === "circuit") await assertCircuitTransfer(page);

    const links = await page.locator(".volume-pre a").evaluateAll((items) => items.map((item) => item.href));
    assert.ok(links.length > 0);
    for (const width of [320, 390, 760, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await settleTextLayout(page);
      const layout = await page.evaluate(() => {
        const art = document.querySelector("[data-volume-decoration]").getBoundingClientRect();
        const toc = document.querySelector(".volume-pre").getBoundingClientRect();
        const text = document.querySelector(".volume-pre").firstChild;
        const frame = new Range();
        frame.setStart(text, 0);
        frame.setEnd(text, text.textContent.indexOf("\n"));
        const link = document.querySelector(".volume-pre a").getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          left: art.left,
          right: art.right,
          width: art.width,
          tocWidth: toc.width,
          frameWidth: frame.getBoundingClientRect().width,
          bottom: art.bottom,
          linkTop: link.top,
          height: art.height
        };
      });
      assert.ok(layout.overflow <= 1 && layout.left >= -1 && layout.right <= width + 1, `${theme}: fits ${width}px`);
      assert.ok(layout.width <= layout.tocWidth + 1, `${theme}: stays within the contents width`);
      assert.ok(Math.abs(layout.width - layout.frameWidth) <= 1, `${theme}: follows the actual font advance`);
      assert.ok(layout.bottom < layout.linkTop, `${theme}: never covers the links`);
      if (width <= 390) assert.ok(layout.height < 110, `${theme}: compact mobile height`);
    }
    assert.deepEqual(await page.locator(".volume-pre a").evaluateAll((items) => items.map((item) => item.href)), links);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => !document.querySelector("[data-volume-decoration]").hasAttribute("data-active"));
    const reduced = await animation();
    assert.ok(reduced.length > 0 && reduced.every(({ state }) => state === "paused"), `${theme}: reduced motion`);
    await page.waitForTimeout(120);
    assert.deepEqual(await animation(), reduced, `${theme}: reduced motion has no frame changes`);
    if (theme === "circuit") await assertCircuitFrozen(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(() => document.querySelector("[data-volume-decoration]").hasAttribute("data-active"));

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    await page.waitForFunction(() => !document.querySelector("[data-volume-decoration]").hasAttribute("data-active"));
    assert.ok(
      (await animation()).every(({ state }) => state === "paused"),
      `${theme}: pagehide pauses`
    );
    if (theme === "circuit") await assertCircuitFrozen(page);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await page.waitForFunction(() => document.querySelector("[data-volume-decoration]").hasAttribute("data-active"));
    console.log(`PASS ${browserName}: ${theme} layout, motion preferences, page lifecycle`);
  }

  await page.goto(new URL("/volume/0/", baseUrl).href);
  await page.locator(".ascii-particles span").first().waitFor({ state: "attached" });
  await page.waitForFunction(() => document.querySelector("[data-volume-decoration]").hasAttribute("data-active"));
  await page.evaluate(() => {
    // Keep a real scroll available even when the volume has only a few articles.
    document.body.style.minHeight = "200vh";
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForFunction(() => !document.querySelector("[data-volume-decoration]").hasAttribute("data-active"));
  assert.ok(
    await page
      .locator("[data-volume-decoration]")
      .evaluate((element) => element.getAnimations({ subtree: true }).every((item) => item.playState === "paused"))
  );
  await assertCircuitFrozen(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector("[data-volume-decoration]").hasAttribute("data-active"));
  await assertCircuitTransfer(page);

  await assertRandomBytes(browser);

  const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  for (const [number, theme] of themes.entries()) {
    await staticPage.goto(new URL(`/volume/${number}/`, baseUrl).href);
    assert.equal(await staticPage.locator("[data-volume-decoration] svg").count(), 1);
    assert.equal(await staticPage.locator("[data-volume-decoration][data-active]").count(), 0);
    assert.ok(await staticPage.locator(".volume-pre a").first().isVisible(), `${theme}: usable without JavaScript`);
    assert.ok(
      await staticPage
        .locator("[data-volume-decoration]")
        .evaluate((element) => element.getAnimations({ subtree: true }).every((item) => item.playState === "paused"))
    );
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${browserName}: offscreen pause and static no-JavaScript artwork`);
} finally {
  await browser.close();
}

function circuitReadouts(page) {
  return page.locator("[data-circuit-register], [data-circuit-bus]").allTextContents();
}

async function assertCircuitTransfer(page) {
  const [, busBefore] = await circuitReadouts(page);
  await page.waitForFunction(
    (previous) => document.querySelector("[data-circuit-bus]").textContent !== previous,
    busBefore
  );
  const [registerDuring, busDuring] = await circuitReadouts(page);
  assert.match(registerDuring, /^[0-9A-F]{2}$/);
  assert.match(busDuring, /^0x[0-9A-F]{2}$/);
  await page.waitForFunction(
    (byte) => document.querySelector("[data-circuit-register]").textContent === byte,
    busDuring.slice(2)
  );
  const [registerAfter, busAfter] = await circuitReadouts(page);
  assert.equal(registerAfter, busAfter.slice(2), "CPU receives the byte shown on the bus");
}

async function assertRandomBytes(browser) {
  const page = await browser.newPage({ reducedMotion: "no-preference" });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    // Constant random sources cover both endpoints without probabilistic assertions.
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
    await page.goto(new URL("/volume/0/", baseUrl).href);
    await page.locator("[data-volume-decoration][data-active]").waitFor({ state: "attached" });
    assert.deepEqual(await circuitReadouts(page), ["00", "0x00"]);
    for (const [random, byte] of [
      [1 - Number.EPSILON, "FF"],
      [0.25, "40"],
      [0, "00"]
    ]) {
      await page.evaluate((value) => {
        Math.random = () => value;
      }, random);
      await page.waitForFunction((expected) => {
        return (
          document.querySelector("[data-circuit-register]").textContent === expected &&
          document.querySelector("[data-circuit-bus]").textContent === `0x${expected}`
        );
      }, byte);
    }
    const duration = await page
      .locator(".circuit-signal--input")
      .evaluate((signal) => signal.getAnimations()[0].effect.getTiming().duration);
    await page.waitForTimeout(duration + 100);
    assert.deepEqual(await circuitReadouts(page), ["00", "0x00"], "Independent random bytes may repeat");
    console.log(`PASS ${browserName}: random CPU bytes include 00, FF, and consecutive repeats`);
  } finally {
    await page.close();
  }
}

async function assertCircuitFrozen(page) {
  const before = await circuitReadouts(page);
  const duration = await page
    .locator(".circuit-signal--input")
    .evaluate((signal) => signal.getAnimations()[0].effect.getTiming().duration);
  await page.waitForTimeout(duration + 100);
  assert.deepEqual(
    await circuitReadouts(page),
    before,
    "Paused circuit readouts stay frozen for a complete transfer cycle"
  );
}
