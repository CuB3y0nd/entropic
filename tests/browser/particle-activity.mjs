import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, settleTextLayout, stubExternalResources } from "./support.mjs";

const browser = await launchBrowser();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });
  await stubExternalResources(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const markup = await context.request.get(baseUrl.href).then((response) => response.text());
  const { config, bootstrap } = await page.evaluate((html) => {
    const document = new DOMParser().parseFromString(html, "text/html");
    return {
      config: JSON.parse(document.body.dataset.particleConfig),
      bootstrap: document.querySelector('script[src*="BaseLayout."]')?.getAttribute("src")
    };
  }, markup);
  assert.ok(bootstrap, "The production bootstrap is available");
  config.pages.home.desktopCount = 0;
  config.pages.home.mobileCount = 4;
  const fixtureUrl = new URL("/__test__/particle-activity/", baseUrl).href;
  const serialized = JSON.stringify(config).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  await context.route(fixtureUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body data-particle-config="${serialized}" data-particles-enabled="true">
      <div class="home-shell"></div><script type="module" src="${bootstrap}"></script></body></html>`
    })
  );
  await context.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.frameRequests = 0;
    window.requestAnimationFrame = (callback) => {
      window.frameRequests += 1;
      return requestFrame(callback);
    };
  });
  await page.goto(fixtureUrl);
  // The bootstrap schedules its optional import after the initial idle delay.
  await page.waitForTimeout(2500);
  assert.equal(await page.locator(".ascii-particles").count(), 0, "Zero particles allocate no layer");

  const assertIdle = async () => {
    await settleTextLayout(page);
    const frames = await page.evaluate(() => window.frameRequests);
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => window.frameRequests),
      frames,
      "Zero or paused particles schedule no frames"
    );
  };
  await assertIdle();
  await page.setViewportSize({ width: 390, height: 800 });
  await page.locator(".ascii-particles span").first().waitFor();
  const frames = await page.evaluate(() => window.frameRequests);
  await page.waitForFunction((count) => window.frameRequests > count + 3, frames);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => document.querySelector(".ascii-particles")?.hidden);
  assert.equal(await page.locator(".ascii-particles span").count(), 0);
  await assertIdle();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 800 });
  await settleTextLayout(page);
  await assertIdle();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(() => document.querySelector(".ascii-particles")?.hidden === false);
  const resumedFrames = await page.evaluate(() => window.frameRequests);
  await page.waitForFunction((count) => window.frameRequests > count + 3, resumedFrames);
  assert.deepEqual(errors, [], "Browser exceptions");
  console.log(
    `PASS ${browserName}: zero-count particles stay idle and resume across breakpoints and motion preferences`
  );
} finally {
  await browser.close();
}
