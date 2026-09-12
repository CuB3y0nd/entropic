import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, settleTextLayout as settle } from "./support.mjs";

const browser = await launchBrowser();

async function createContext({ holdFont = Promise.resolve(), width = 390 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    window.fitSegmentCalls = 0;
    const segment = Intl.Segmenter.prototype.segment;
    Intl.Segmenter.prototype.segment = function (...args) {
      window.fitSegmentCalls++;
      return segment.apply(this, args);
    };
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== baseUrl.origin) {
      return route.fulfill({ status: 200, body: "" });
    }
    if (url.pathname.endsWith("/gohu-subset.woff")) {
      await holdFont;
    }
    return route.continue();
  });
  return context;
}

async function readFit(page) {
  return page.evaluate(() => ({
    segments: window.fitSegmentCalls,
    scale: Number(
      document.querySelector("[data-textmode-fit-scope], .textmode-wrap")?.style.getPropertyValue("--fit-scale")
    )
  }));
}

async function waitForFit(page) {
  await page.waitForFunction(() =>
    document.querySelector("[data-textmode-fit-scope], .textmode-wrap")?.style.getPropertyValue("--fit-scale")
  );
  await settle(page);
}

const errors = [];
try {
  const context = await createContext();
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  let homeScale;
  for (const route of ["/", "/volume/0/", "/volume/3/ansi-ink-phile/", "/volume/1/csapp/"]) {
    await page.goto("about:blank");
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(new URL(route, baseUrl).href);
    assert.equal(response.status(), 200, route);
    await waitForFit(page);
    const initial = await readFit(page);
    assert.ok(initial.segments > 0 && initial.scale > 0 && initial.scale < 1, `Measured content: ${route}`);
    if (route === "/") homeScale = initial.scale;

    for (const width of [391, 500, 390, 1280, 1400, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await settle(page);
      const resized = await readFit(page);
      assert.equal(resized.segments, initial.segments, `Resize must reuse prepared widths: ${route} at ${width}px`);
      const expected = width <= 760 ? Math.min(1, (initial.scale * width) / 390) : initial.scale;
      assert.ok(Math.abs(resized.scale - expected) < 0.0002, `Fit follows viewport width: ${route} at ${width}px`);
    }
    console.log(`PASS ${browserName} ${route}: mobile fitting, cached resizes, desktop return`);
  }
  await context.close();

  const desktopContext = await createContext({ width: 1280 });
  const desktop = await desktopContext.newPage();
  desktop.on("pageerror", (error) => errors.push(error.message));
  await desktop.goto(baseUrl.href);
  await settle(desktop);
  assert.equal((await readFit(desktop)).segments, 0, "Desktop-only visits do not prepare text");
  await desktop.setViewportSize({ width: 390, height: 844 });
  await waitForFit(desktop);
  assert.equal((await readFit(desktop)).scale, homeScale, "Entering mobile layout installs the fitter");
  await desktopContext.close();

  // Hold the real font beyond the former 1.2s timeout, then release it without
  // a resize. A loaded font must replace the cached fallback-font metrics.
  const font = Promise.withResolvers();
  const delayedContext = await createContext({ holdFont: font.promise });
  try {
    const delayed = await delayedContext.newPage();
    delayed.on("pageerror", (error) => errors.push(error.message));
    await delayed.goto(baseUrl.href, { waitUntil: "domcontentloaded" });
    await delayed.waitForFunction(() =>
      document.querySelector("[data-textmode-fit-scope]")?.style.getPropertyValue("--fit-scale")
    );
    await delayed.waitForTimeout(1500);
    assert.equal(await delayed.evaluate(() => document.fonts.check("14px gohu")), false);
    const fallback = await readFit(delayed);
    assert.notEqual(fallback.scale, homeScale, "The held font exercises different fallback metrics");
    font.resolve();
    await settle(delayed);
    await delayed.waitForFunction(
      (expected) =>
        Number(document.querySelector("[data-textmode-fit-scope]")?.style.getPropertyValue("--fit-scale")) === expected,
      homeScale
    );
    assert.ok((await readFit(delayed)).segments > fallback.segments, "Font completion invalidates prepared widths");
    console.log(`PASS ${browserName}: lazy mobile startup and delayed font correction without resizing`);
  } finally {
    font.resolve();
    await delayedContext.close();
  }
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
