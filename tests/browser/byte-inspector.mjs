import assert from "node:assert/strict";
import {
  baseUrl,
  browserName,
  launchBrowser,
  selectArticleText,
  settleTextLayout,
  stubExternalResources
} from "./support.mjs";

const browser = await launchBrowser();
const errors = [];
try {
  for (const width of [1280, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: "reduce" });
    await stubExternalResources(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("/volume/0/netgear-exs27-0/", baseUrl).href);
    await settleTextLayout(page);
    const trigger = page.locator("[data-inspect-trigger]");
    const panel = page.getByRole("dialog", { name: "Byte inspector" });
    const root = page.locator("[data-selection-tools]");
    assert.equal(await root.isVisible(), false, "Reading alone never opens the inspector");

    // Exercise native Copy/Paste in this isolated browser, without a clipboard API mock.
    await page.evaluate(() => {
      const field = document.createElement("textarea");
      field.dataset.copyProbe = "";
      field.style.cssText = "position:fixed;bottom:0;left:0;width:120px;height:24px;z-index:999";
      document.body.append(field);
    });
    const copyProbe = page.locator("[data-copy-probe]");
    await copyProbe.fill("original clipboard");
    await copyProbe.press("Control+a");
    await copyProbe.press("Control+c");
    await copyProbe.evaluate((field) => field.blur());

    await selectArticleText(page, "00 02 00 00");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await panel.waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => window.getSelection().toString()), "00 02 00 00");
    await page.getByRole("button", { name: "Select UINT LE: 512", exact: true }).click();
    assert.equal(await page.evaluate(() => window.getSelection().toString()), "512", "Click selects only the value");
    await page.keyboard.press("Control+c");
    const box = await panel.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width, "Panel fits the viewport");
    assert.ok(box.y >= 0 && box.y + box.height <= 800, "Panel remains vertically visible");

    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    assert.ok(await trigger.evaluate((node) => node === document.activeElement), "Escape returns focus to the trigger");
    await page.keyboard.press("Enter");
    await panel.waitFor({ state: "visible" });
    await page.mouse.click(1, 100);
    await root.waitFor({ state: "hidden" });
    await copyProbe.fill("");
    await copyProbe.press("Control+v");
    assert.equal(await copyProbe.inputValue(), "512", "Native Copy transfers the selected value");
    await copyProbe.evaluate((field) => field.remove());

    await selectArticleText(page, "00 02 00 00 88 df 74 2f");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await panel.waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-inspect-kind]").textContent(), "/ 8 BYTES", "Selection crosses ANSI spans");
    await page.evaluate(() => window.scrollBy(0, 80));
    await root.waitFor({ state: "hidden" });

    await selectArticleText(page, "0x20000");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    assert.equal(await page.locator("[data-inspect-kind]").textContent(), "/ INTEGER");
    const binary = page.getByRole("button", { name: "Select BIN: 0b100000000000000000", exact: true });
    await binary.focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await page.evaluate(() => window.getSelection().toString()),
      "0b100000000000000000",
      "Keyboard activation selects the full value"
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => window.getSelection().toString()),
      "0x20000",
      "Closing returns the article selection"
    );

    await page.mouse.click(1, 100);
    await selectArticleText(page, "AES-CBC");
    // Selection handling is debounced until a drag/keyboard selection settles.
    await page.waitForTimeout(250);
    assert.equal(await trigger.isVisible(), false, "Prose does not activate the inspector");
    await selectArticleText(page, "0", ".phile-header-meta");
    await page.waitForTimeout(250);
    assert.equal(await root.isVisible(), false, "Header metadata is outside the reading tool");

    await page.goto(new URL("/volume/3/inspect-field-notes/", baseUrl).href);
    await settleTextLayout(page);
    await selectArticleText(page, "-1");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await page.getByRole("combobox", { name: "Bit width", exact: true }).selectOption("16");
    await page.getByRole("button", { name: "Select HEX: 0xffff", exact: true }).click();
    assert.equal(await page.evaluate(() => window.getSelection().toString()), "0xffff");
    await page.getByRole("combobox", { name: "View", exact: true }).selectOption("bits");
    assert.ok(await page.getByRole("button", { name: "Select POPCNT: 16", exact: true }).isVisible());
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => window.getSelection().toString()),
      "-1",
      "View changes retain the source range"
    );
    await page.mouse.click(1, 100);

    await selectArticleText(page, "-1 < 0U");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    assert.ok(await page.getByRole("button", { name: "Select LEFT: 4294967295", exact: true }).isVisible());
    assert.ok(await page.getByRole("button", { name: "Select RESULT: false", exact: true }).isVisible());
    const comparisonBox = await panel.boundingBox();
    assert.ok(comparisonBox.x >= 0 && comparisonBox.x + comparisonBox.width <= width);
    assert.ok(comparisonBox.y >= 0 && comparisonBox.y + comparisonBox.height <= 800);
    await page.mouse.click(1, 100);

    await selectArticleText(page, "00 80 34 41");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await page.getByRole("combobox", { name: "View", exact: true }).selectOption("float32");
    assert.ok(await page.getByRole("button", { name: "Select VALUE: 11.28125", exact: true }).isVisible());
    await page.getByRole("combobox", { name: "Byte order", exact: true }).selectOption("be");
    assert.ok(await page.getByRole("button", { name: "Select HEX: 0x00803441", exact: true }).isVisible());
    await page.mouse.click(1, 100);

    await selectArticleText(page, "0.1f");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    assert.ok(await page.getByRole("button", { name: "Select VALUE: 0.10000000149011612", exact: true }).isVisible());
    await page.mouse.click(1, 100);

    await selectArticleText(page, "c3 a9");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await page.getByRole("combobox", { name: "View", exact: true }).selectOption("text");
    assert.ok(await page.getByRole("button", { name: 'Select UTF-8: "é"', exact: true }).isVisible());

    await context.close();
    console.log(
      `PASS ${browserName} ${width}px: native copy, width, comparison, endian, floats, text, dismissal, bounds`
    );
  }
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: browserName === "chromium",
    reducedMotion: "reduce"
  });
  await stubExternalResources(phone);
  const page = await phone.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const engineUrl = (url) => /\/(?:inspection\/inspect\.ts|_astro\/inspect\.[^/]+\.js)$/.test(url.pathname);
  const gate = Promise.withResolvers();
  await page.route(engineUrl, async (route) => {
    await gate.promise;
    await route.continue();
  });
  try {
    await page.goto(new URL("/volume/3/inspect-field-notes/", baseUrl).href);
    await settleTextLayout(page);
    const loading = page.waitForRequest((request) => engineUrl(new URL(request.url())));
    await selectArticleText(page, "-1");
    const request = await loading;
    await page.touchscreen.tap(1, 100);
    gate.resolve();
    await page.evaluate((url) => import(url).then(() => true), request.url());
    const root = page.locator("[data-selection-tools]");
    assert.equal(await root.isVisible(), false, "Canceled selection stays closed after a delayed engine load");

    await selectArticleText(page, "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0");
    const trigger = page.locator("[data-inspect-trigger]");
    await trigger.waitFor({ state: "visible" });
    const entryBox = await trigger.boundingBox();
    assert.ok(entryBox.height >= 28 && entryBox.height <= 32, "The phone entry stays compact and tappable");
    await trigger.tap();
    const panel = page.getByRole("dialog", { name: "Byte inspector" });
    await page.getByRole("combobox", { name: "View", exact: true }).selectOption("bits");
    await panel.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await settleTextLayout(page);
    const view = page.getByRole("combobox", { name: "View", exact: true });
    assert.ok(await view.isVisible(), "View controls remain reachable while long results scroll");
    const toolbarBox = await view.boundingBox();
    const panelBox = await panel.boundingBox();
    assert.ok(panelBox.width <= 300, "The phone inspector leaves room beside the article");
    assert.ok(panelBox.height <= 360.1, "Long results scroll inside a compact panel");
    assert.ok(toolbarBox.y >= panelBox.y && toolbarBox.y + toolbarBox.height < panelBox.y + panelBox.height);
    await page.getByRole("combobox", { name: "Bit width", exact: true }).selectOption("8");
    await page.getByRole("button", { name: "Select HEX: 0xf0", exact: true }).tap();
    assert.equal(await page.evaluate(() => window.getSelection().toString()), "0xf0", "Touch selects the value");

    await page.setViewportSize({ width: 390, height: 400 });
    await settleTextLayout(page);
    assert.ok(await panel.isVisible(), "A visible source retains its inspector after a viewport resize");
    const resized = await panel.boundingBox();
    assert.ok(resized.x >= 0 && resized.x + resized.width <= 390);
    assert.ok(resized.y >= 0 && resized.y + resized.height <= 400);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log(`PASS ${browserName} touch: deferred load cancellation, value selection, scrolling, viewport resize`);
  } finally {
    gate.resolve();
    await phone.close();
  }
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
