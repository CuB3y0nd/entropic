import assert from "node:assert/strict";
import sharp from "sharp";
import { baseUrl, browserName, launchBrowser, settleTextLayout, stubExternalResources } from "./support.mjs";

const samples = [
  ["maze", "/volume/0/netgear-exs27-0/"],
  ["sort", "/volume/1/cross-isas/"],
  ["bits", "/volume/1/libxml2-cve-2017-9048/"],
  ["asm", "/volume/1/blackhat-mea-ctf-final-2025/"],
  ["reorder", "/volume/1/libtiff-cve-2016-9297/"]
];
const browser = await launchBrowser();
const errors = [];
const frame = (page) => page.locator("[data-algorithm-art]").evaluate((root) => root.innerHTML);
const expectMotion = async (page, previous) => {
  previous ??= await frame(page);
  await page.waitForFunction((before) => document.querySelector("[data-algorithm-art]").innerHTML !== before, previous);
};
const expectFrozen = async (page) => {
  await page.waitForTimeout(100);
  const before = await frame(page);
  await page.waitForTimeout(600);
  assert.equal(await frame(page), before);
  return before;
};

async function assertBarSpacing(page) {
  const svg = page.locator("[data-algorithm-art] svg");
  const width = await svg.evaluate((element) => element.getBoundingClientRect().width * devicePixelRatio);
  const { data, info } = await sharp(await svg.screenshot())
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Sample the common baseline inside the overlaid Gohu border.
  const border = Math.max(2, Math.ceil((2 * width) / 184));
  const y = info.height - Math.max(4, border + 1);
  const row = [];
  for (let x = border; x < info.width - border; x += 1) {
    const offset = (y * info.width + x) * info.channels;
    const filled = Math.max(data[offset], data[offset + 1], data[offset + 2]) > 50;
    if (row.at(-1)?.filled === filled) row.at(-1).length += 1;
    else row.push({ filled, length: 1 });
  }
  const gaps = row
    .slice(1, -1)
    .filter((run) => !run.filled)
    .map((run) => run.length);
  assert.equal(gaps.length, 13, "All 14 bars stay separated");
  assert.deepEqual(
    new Set(gaps),
    new Set([Math.max(1, Math.round((2 * width) / 184))]),
    "All rendered gaps have identical pixel widths"
  );
}

async function assertBitAlignment(page) {
  const offsets = await page.locator("[data-algorithm-art]").evaluate((root) => {
    const labels = [...root.querySelectorAll(".algorithm-label")];
    const digits = labels.filter((label) => /^[0-7]$/.test(label.textContent));
    const cells = labels.filter((label) => /^[█░]{2}$/.test(label.textContent));
    const top = cells[0].getBoundingClientRect().top;
    const row = cells.filter((cell) => Math.abs(cell.getBoundingClientRect().top - top) < 0.1);
    const center = (node) => {
      const rect = node.getBoundingClientRect();
      return rect.left + rect.width / 2;
    };
    return digits.map((digit, index) => center(digit) - center(row[index]));
  });
  assert.equal(offsets.length, 8);
  assert.ok(
    offsets.every((offset) => Math.abs(offset) < 0.1),
    "Bit numbers remain centered under their cells"
  );
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await stubExternalResources(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [kind, path] of samples) {
    await page.goto(new URL(path, baseUrl).href);
    await page.locator(".ascii-particles span").first().waitFor({ state: "attached" });
    await settleTextLayout(page);
    assert.equal(await page.locator("[data-algorithm-art]").getAttribute("data-algorithm-art"), kind);
    assert.equal(await page.locator("[data-algorithm-art]").getAttribute("aria-hidden"), "true");
    await expectMotion(page);
    for (const width of [320, 390, 760, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await settleTextLayout(page);
      const layout = await page.locator("[data-algorithm-art]").evaluate((root) => {
        const art = root.getBoundingClientRect();
        const svg = root.querySelector("svg");
        const surface = (svg ?? root.querySelector("[data-algorithm-labels]")).getBoundingClientRect();
        const inset = svg ? 0.5 : 1;
        const glyphs = root.querySelector("[data-life-line]").getBoundingClientRect();
        const cell = glyphs.width / 25;
        const line = art.height / 17;
        const styles = getComputedStyle(root.querySelector("pre"));
        const body = document.querySelector(".phile-body-pre").getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          right: art.right,
          bottom: art.bottom,
          bodyTop: body.top,
          offsets: [surface.left - art.left - cell * inset, surface.top - art.top - line * inset],
          sizes: [surface.width - cell * (25 - inset * 2), surface.height - line * (17 - inset * 2)],
          font: styles.fontFamily,
          bodyFont: getComputedStyle(document.querySelector(".phile-body-pre")).fontFamily
        };
      });
      assert.ok(layout.overflow <= 1 && layout.right <= width + 1, `${kind}: fits ${width}px`);
      assert.ok(layout.bottom <= layout.bodyTop, `${kind}: stays clear of article content`);
      assert.ok(
        [...layout.offsets, ...layout.sizes].every((value) => Math.abs(value) < 1),
        `${kind}: fills the Gohu frame at ${width}px`
      );
      assert.equal(layout.font, layout.bodyFont);
      const textLayout = await page.locator("[data-algorithm-art]").evaluate((root) => {
        const labels = [...root.querySelectorAll(".algorithm-label")].filter((label) => label.textContent);
        if (!labels.length) return null;
        const art = root.getBoundingClientRect();
        const body = getComputedStyle(document.querySelector(".phile-body-pre"));
        return {
          fits: labels.every((label) => {
            const bounds = label.getBoundingClientRect();
            return (
              bounds.left >= art.left &&
              bounds.right <= art.right &&
              bounds.top >= art.top &&
              bounds.bottom <= art.bottom
            );
          }),
          nativeFont: labels.every((label) => {
            const style = getComputedStyle(label);
            return style.fontFamily === body.fontFamily && style.fontSize === body.fontSize;
          })
        };
      });
      if (["bits", "asm", "reorder"].includes(kind)) {
        assert.deepEqual(textLayout, { fits: true, nativeFont: true }, `${kind}: native Gohu text fits at ${width}px`);
      }
      if (kind === "sort") await assertBarSpacing(page);
      if (kind === "bits") await assertBitAlignment(page);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await expectFrozen(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expectMotion(page, reduced);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    const hidden = await expectFrozen(page);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expectMotion(page, hidden);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => document.querySelector("[data-algorithm-art]").getBoundingClientRect().bottom < 0);
    const offscreen = await expectFrozen(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectMotion(page, offscreen);
    console.log(
      `PASS ${browserName}: ${kind} frame fill, desktop/mobile/desktop, reduced motion, page lifecycle, offscreen pause`
    );
  }

  const staticContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await stubExternalResources(staticContext);
  const staticPage = await staticContext.newPage();
  for (const [kind, path] of samples) {
    await staticPage.goto(new URL(path, baseUrl).href);
    assert.equal(await staticPage.locator("[data-algorithm-art]").getAttribute("data-algorithm-art"), kind);
    assert.ok((await frame(staticPage)).length > 50, `${kind}: useful artwork without JavaScript`);
    assert.ok(await staticPage.locator(".phile-body-pre").first().isVisible());
  }

  const stillContext = await browser.newContext({ reducedMotion: "reduce" });
  await stubExternalResources(stillContext);
  const stillPage = await stillContext.newPage();
  await stillPage.goto(new URL(samples[0][1], baseUrl).href);
  const initial = await expectFrozen(stillPage);
  assert.ok(initial.length > 50);
  await stillPage.emulateMedia({ reducedMotion: "no-preference" });
  await expectMotion(stillPage, initial);

  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    reducedMotion: "reduce"
  });
  await stubExternalResources(phoneContext);
  const phonePage = await phoneContext.newPage();
  for (const [kind, path] of samples.filter(([kind]) => kind === "sort" || kind === "bits")) {
    await phonePage.goto(new URL(path, baseUrl).href);
    await settleTextLayout(phonePage);
    if (kind === "sort") await assertBarSpacing(phonePage);
    else await assertBitAlignment(phonePage);
  }
  console.log(`PASS ${browserName}: uniform bar gaps and centered bit numbers at desktop and phone pixel densities`);

  const bitPath = samples.find(([kind]) => kind === "bits")[1];
  const bitUrl = new URL(bitPath, baseUrl).href;
  for (const speed of [1, 2]) {
    await page.route(bitUrl, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace(/data-speed="1"/, `data-speed="${speed}"`)
      });
    });
    await page.goto(bitUrl);
    await page.locator(".ascii-particles span").first().waitFor({ state: "attached" });
    const clock = () =>
      page
        .locator(".algorithm-label")
        .filter({ hasText: /^T [0-9A-F]{4}$/ })
        .textContent();
    const before = Number.parseInt((await clock()).slice(2), 16);
    await page.waitForTimeout(1500);
    const steps = (Number.parseInt((await clock()).slice(2), 16) - before + 65536) % 65536;
    assert.ok(Math.abs(steps - 3 * speed) <= 1, `Byte steps follow ${speed}x speed: ${steps} steps`);
    await page.unroute(bitUrl);
  }
  console.log(`PASS ${browserName}: discrete playback cadence and speed multiplier`);

  // Exercise static configuration without mutating files or starting a second server.
  await context.route(new URL(samples[0][1], baseUrl).href, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/data-animated="true"/, "") });
  });
  await page.goto(new URL(samples[0][1], baseUrl).href);
  await page.locator(".ascii-particles span").first().waitFor({ state: "attached" });
  assert.equal(await page.locator("[data-algorithm-art][data-animated]").count(), 0);
  await expectFrozen(page);
  assert.deepEqual(errors, [], "Browser exceptions");
  console.log(`PASS ${browserName}: static config, initial reduced motion, and no-JavaScript artwork`);
} finally {
  await browser.close();
}
