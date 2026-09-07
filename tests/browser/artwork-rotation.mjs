import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, settleTextLayout, stubExternalResources } from "./support.mjs";

const dayMs = 86_400_000;
const shanghaiOffsetMs = 8 * 3_600_000;
const browser = await launchBrowser();
const errors = [];

try {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    timezoneId: "America/Los_Angeles",
    viewport: { width: 1280, height: 800 }
  });
  await stubExternalResources(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const markup = await context.request.get(baseUrl.href).then((response) => response.text());
  assert.equal(
    [...markup.matchAll(/class="badge-action"/g)].length,
    17,
    "The response contains one set of controls, independent of the artwork catalog"
  );
  const presetIds = [...markup.matchAll(/<template data-artwork-id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(presetIds.length, 25, "The complete approved catalog participates in rotation");
  const selectedId = () => page.locator(".artwork-rotation").getAttribute("data-active-artwork");
  const artworkRequests = new Set();
  page.on("request", (request) => {
    if (request.resourceType() === "image" && new URL(request.url()).pathname.startsWith("/_astro/")) {
      artworkRequests.add(request.url());
    }
  });

  await page.clock.setFixedTime(new Date("2026-09-07T04:00:00Z"));
  await page.goto(baseUrl.href);
  await settleTextLayout(page);
  const today = await selectedId();
  const buttonOrder = () =>
    page.locator(".badge-action > img").evaluateAll((images) => images.map((image) => image.src));
  const deployedOrder = await buttonOrder();
  assert.ok(presetIds.includes(today));
  for (const time of ["2026-09-06T16:00:00Z", "2026-09-07T15:59:59.999Z"]) {
    await page.clock.setFixedTime(new Date(time));
    await page.reload();
    assert.equal(await selectedId(), today, "The Shanghai calendar date stays stable throughout the day");
  }
  await page.clock.setFixedTime(new Date("2026-09-07T16:00:00Z"));
  await page.reload();
  assert.notEqual(await selectedId(), today, "Shanghai midnight advances the artwork even in a US browser time zone");

  const todayNumber = Math.floor(Date.UTC(2026, 8, 7) / dayMs);
  const cycleStart = Math.floor(todayNumber / presetIds.length) * presetIds.length;
  const seen = [];
  for (let offset = 0; offset <= presetIds.length; offset += 1) {
    await page.clock.setFixedTime(new Date((cycleStart + offset) * dayMs - shanghaiOffsetMs + 12 * 3_600_000));
    artworkRequests.clear();
    await page.reload();
    const id = await selectedId();
    assert.deepEqual(await buttonOrder(), deployedOrder, "Artwork changes keep the deployment's button order");
    assert.ok(presetIds.includes(id));
    if (offset > 0) assert.notEqual(id, seen.at(-1), "Adjacent days and the cycle boundary do not repeat");
    seen.push(id);
    const visibleImages = page.locator(".badge-artwork, .badge-companion img");
    const selectedSources = new Set();
    for (const image of await visibleImages.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element) => element.decode());
      selectedSources.add(await image.evaluate((element) => element.currentSrc));
    }
    assert.ok(artworkRequests.size > 0);
    assert.ok(
      [...artworkRequests].every((url) => selectedSources.has(url)),
      "Inert templates and noscript fallback must not download unselected artwork"
    );
  }
  assert.equal(
    new Set(seen.slice(0, presetIds.length)).size,
    presetIds.length,
    "Every preset appears exactly once in a cycle"
  );
  console.log(
    `PASS ${browserName}: stable Shanghai dates, midnight rollover, all 25 presets, no boundary repeat, selected images only`
  );

  // A tab/history restore on a later date rechecks the schedule and preserves
  // a keyboard user's position among the actual controls.
  const copyButton = page.getByRole("button", { name: "Copy Discord", exact: true });
  await copyButton.focus();
  await copyButton.evaluate((button) => {
    window.originalCopyButton = button;
  });
  const beforeRestore = await selectedId();
  await page.clock.setFixedTime(
    new Date((cycleStart + presetIds.length + 1) * dayMs - shanghaiOffsetMs + 12 * 3_600_000)
  );
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  assert.notEqual(await selectedId(), beforeRestore);
  assert.deepEqual(await buttonOrder(), deployedOrder, "History restoration keeps the deployment's button order");
  assert.equal(await copyButton.evaluate((action) => document.activeElement === action), true);
  assert.equal(await copyButton.evaluate((action) => action === window.originalCopyButton), true);
  const focusId = await selectedId();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  assert.equal(await selectedId(), focusId, "Same-period restoration does not redraw the panel");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.copiedText = text;
        }
      }
    });
  });
  await copyButton.press("Enter");
  await page.waitForFunction(() => window.copiedText === "CuB3y0nd#6307");
  assert.equal(await page.locator(".badge-copy-status").textContent(), "Copied!");

  // An open manual-copy dialog must survive the day changing in a hidden tab.
  await page.evaluate(() => {
    const dialog = document.querySelector(".badge-copy-dialog");
    dialog.showPopover();
    const input = dialog.querySelector("textarea");
    input.focus();
    input.setSelectionRange(2, 7);
  });
  await page.clock.setFixedTime(new Date((cycleStart + presetIds.length + 2) * dayMs));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  assert.notEqual(await selectedId(), focusId);
  assert.deepEqual(
    await page.locator(".badge-copy-dialog textarea").evaluate((input) => ({
      open: input.parentElement.matches(":popover-open"),
      focused: document.activeElement === input,
      start: input.selectionStart,
      end: input.selectionEnd
    })),
    { open: true, focused: true, start: 2, end: 7 },
    "Rotation preserves the open popover, focus, and selection"
  );
  await page.evaluate(() => document.querySelector(".badge-copy-dialog").hidePopover());
  await page.waitForFunction(() => document.querySelector(".badge-copy-status")?.textContent === "");

  await page.evaluate(() => {
    navigator.clipboard.writeText = () =>
      new Promise((resolve) => {
        window.finishCopy = resolve;
      });
  });
  await copyButton.click();
  await page.waitForFunction(() => window.finishCopy !== undefined);
  await page.clock.setFixedTime(new Date((cycleStart + presetIds.length + 3) * dayMs));
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    window.finishCopy();
  });
  await page.waitForFunction(() => document.querySelector(".badge-copy-status")?.textContent === "Copied!");
  assert.equal(await copyButton.getAttribute("aria-busy"), null);
  await context.close();

  const otherZone = await browser.newContext({ reducedMotion: "reduce", timezoneId: "Pacific/Auckland" });
  await stubExternalResources(otherZone);
  const otherPage = await otherZone.newPage();
  otherPage.on("pageerror", (error) => errors.push(error.message));
  await otherPage.clock.setFixedTime(new Date("2026-09-07T04:00:00Z"));
  await otherPage.goto(baseUrl.href);
  assert.equal(
    await otherPage.locator(".artwork-rotation").getAttribute("data-active-artwork"),
    today,
    "Visitors share the configured time zone, not their device time zone"
  );
  await otherZone.close();

  const noScript = await browser.newContext({ javaScriptEnabled: false });
  await stubExternalResources(noScript);
  const fallback = await noScript.newPage();
  await fallback.goto(baseUrl.href);
  assert.equal(await fallback.locator(".site-badges").count(), 1);
  assert.equal(await fallback.locator(".badge-action").count(), 17);
  assert.deepEqual(
    await fallback.locator(".badge-action > img").evaluateAll((images) => images.map((image) => image.src)),
    deployedOrder,
    "The no-JavaScript fallback shares the deployment's button order"
  );
  await fallback.locator(".badge-artwork").scrollIntoViewIfNeeded();
  assert.ok((await fallback.locator(".badge-artwork").getAttribute("src")).includes("nagara-nozomi"));
  assert.ok(await fallback.locator(".badge-artwork").isVisible());
  await fallback.getByRole("button", { name: "Copy Discord", exact: true }).click();
  assert.equal(await fallback.locator(".badge-copy-dialog:popover-open textarea").inputValue(), "CuB3y0nd#6307");
  await noScript.close();
  console.log(
    `PASS ${browserName}: cross-time-zone consistency, history restoration and focus, no-JavaScript fallback`
  );
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
