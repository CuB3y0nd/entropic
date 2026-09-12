import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, settleTextLayout, stubExternalResources } from "./support.mjs";

const browser = await launchBrowser();
const errors = [];

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 3,
    reducedMotion: "reduce"
  });
  await stubExternalResources(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("/volume/3/", baseUrl).href);
  await settleTextLayout(page);
  const trigger = page.locator("[data-credits-trigger]").first();
  const panel = page.locator(`[id="${await trigger.getAttribute("popovertarget")}"]`);
  await trigger.tap();
  await panel.waitFor({ state: "visible" });

  async function assertPlacement() {
    const target = await trigger.boundingBox();
    const bounds = await panel.boundingBox();
    const viewport = page.viewportSize();
    const left = Math.max(12, Math.min(target.x + target.width - bounds.width, viewport.width - 12 - bounds.width));
    const top = Math.max(12, Math.min(target.y + target.height + 8, viewport.height - 12 - bounds.height));
    assert.ok(Math.abs(bounds.x - left) < 1 && Math.abs(bounds.y - top) < 1, "Credits stay beside their trigger");
    assert.ok(bounds.x >= 11.9 && bounds.x + bounds.width <= viewport.width - 11.9, "Credits fit the viewport width");
    assert.ok(
      bounds.y >= 11.9 && bounds.y + bounds.height <= viewport.height - 11.9,
      "Credits fit the viewport height"
    );
  }

  // Keep the popover open while article fitting changes across breakpoints.
  for (const width of [390, 320, 700, 760, 1280, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : width === 700 ? 360 : 844 });
    await settleTextLayout(page);
    await assertPlacement();
    if (width === 390) {
      const bounds = await panel.boundingBox();
      assert.ok(bounds.width <= 300 && bounds.height <= 40, "A short contributor list stays compact on phones");
    }
  }

  await page.keyboard.press("Escape");
  assert.equal(await panel.isVisible(), false);
  await trigger.tap();
  await page.touchscreen.tap(4, 4);
  assert.equal(await panel.isVisible(), false, "Tapping outside dismisses credits");
  await trigger.press("Enter");
  await panel.waitFor({ state: "visible" });

  // Exercise a longer list without adding synthetic authors to site content.
  await panel.locator("ol").evaluate((list) => {
    for (let index = 0; index < 120; index++) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `https://example.test/contributor/${index}`;
      link.textContent = `Contributor ${index}`;
      item.append(link);
      list.append(item);
    }
  });
  await page.setViewportSize({ width: 390, height: 400 });
  await settleTextLayout(page);
  await assertPlacement();
  const list = panel.locator("ol");
  assert.ok(await list.evaluate((node) => node.scrollHeight > node.clientHeight), "Long contributor lists scroll");
  const scrollY = await page.evaluate(() => window.scrollY);
  await list.locator("a").last().focus();
  const last = await list.locator("a").last().boundingBox();
  const bounds = await panel.boundingBox();
  assert.ok(
    last.y >= bounds.y && last.y + last.height <= bounds.y + bounds.height,
    "The last contributor is reachable"
  );
  assert.equal(await page.evaluate(() => window.scrollY), scrollY, "Scrolling credits keeps the page stationary");
  assert.deepEqual(errors, [], "Browser exceptions");
  await context.close();
  console.log(`PASS ${browserName}: compact credits, resize anchoring, touch, keyboard and long lists`);
} finally {
  await browser.close();
}
