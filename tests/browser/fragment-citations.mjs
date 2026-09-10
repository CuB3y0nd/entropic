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
const route = "/volume/3/inspect-field-notes/";
const quote = "Width and rank both matter.";

async function openLink(page, text) {
  await selectArticleText(page, text);
  await page.locator("[data-fragment-trigger]").click();
  const field = page.getByRole("textbox", { name: "Link to selected text" });
  await field.waitFor({ state: "visible" });
  return field.inputValue();
}

async function highlighted(page) {
  await page.waitForFunction(() => CSS.highlights?.has("entropic-fragment"));
  return page.evaluate(() => {
    const range = [...CSS.highlights.get("entropic-fragment")][0];
    const bounds = range.getBoundingClientRect();
    const stroke = document.querySelector(".fragment-marker-line")?.getBoundingClientRect();
    // Range endpoints measure the hidden fallback font; bitmap glyphs can be wider.
    const firstGlyph = range.startContainer.parentElement?.closest(".cjk-bitmap")?.getBoundingClientRect();
    const lastGlyph = range.endContainer.parentElement?.closest(".cjk-bitmap")?.getBoundingClientRect();
    const painted = {
      left: firstGlyph?.left ?? bounds.left,
      right: lastGlyph?.right ?? bounds.right,
      top: Math.min(firstGlyph?.top ?? bounds.top, lastGlyph?.top ?? bounds.top),
      bottom: Math.max(firstGlyph?.bottom ?? bounds.bottom, lastGlyph?.bottom ?? bounds.bottom)
    };
    return {
      text: range.toString(),
      top: bounds.top,
      strokes: document.querySelectorAll(".fragment-marker-line").length,
      aligned: !!stroke && ["left", "right", "top", "bottom"].every((key) => Math.abs(stroke[key] - painted[key]) < 1)
    };
  });
}

try {
  for (const width of [1280, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: "reduce" });
    await stubExternalResources(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const requests = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    await page.goto(new URL(route, baseUrl).href);
    await settleTextLayout(page);
    assert.equal(
      requests.some((path) => /\/(?:citations\/document\.ts|_astro\/document\.[^/]+\.js)$/.test(path)),
      false,
      "Ordinary reading does not load the quote index"
    );
    const html = await page.locator(".phile-body-pre").innerHTML();
    const url = await openLink(page, quote);
    assert.equal(new URL(url).hash, "#cite=Width+and+rank+both+matter.");
    const panel = page.getByRole("dialog", { name: "Fragment link", exact: true });
    const field = page.getByRole("textbox", { name: "Link to selected text" });
    const box = await panel.boundingBox();
    assert.ok(
      box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 800,
      "Link panel fits the viewport"
    );
    await field.click();
    assert.deepEqual(await field.evaluate((node) => [node.selectionStart, node.selectionEnd]), [0, url.length]);
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => getSelection().toString()), quote, "Escape restores the passage");
    assert.ok(await page.locator("[data-fragment-trigger]").evaluate((node) => node === document.activeElement));
    await page.keyboard.press("Enter");
    await panel.waitFor({ state: "visible" });
    await page.mouse.click(1, 100);
    await page.evaluate(() => {
      const probe = document.createElement("textarea");
      probe.dataset.copyProbe = "";
      probe.style.cssText = "position:fixed;bottom:0;left:0;width:120px;height:24px;z-index:999";
      document.body.append(probe);
      probe.focus();
    });
    await page.keyboard.press("Control+v");
    assert.equal(await page.locator("[data-copy-probe]").inputValue(), url, "Native Copy/Paste transfers the URL");
    await page.locator("[data-copy-probe]").evaluate((node) => node.remove());

    await selectArticleText(page, "-1");
    await page.locator("[data-inspect-trigger]").click();
    await page.getByRole("combobox", { name: "Bit width", exact: true }).selectOption("16");
    await page.keyboard.press("Escape");
    await page.locator("[data-fragment-trigger]").click();
    await field.waitFor({ state: "visible" });
    const repeatedUrl = await field.inputValue();
    assert.ok(new URL(repeatedUrl).hash.includes("prefix="), "Repeated numbers carry context");
    await page.keyboard.press("Escape");
    await page.locator("[data-inspect-trigger]").click();
    assert.equal(
      await page.getByRole("combobox", { name: "Bit width", exact: true }).inputValue(),
      "16",
      "Switching tools retains inspector choices and the original range"
    );

    await page.goto("about:blank");
    await page.goto(url);
    const target = await highlighted(page);
    assert.equal(target.text, quote);
    assert.ok(Math.abs(target.top - 200) <= 2, "Fresh navigation locates the passage after text fitting");
    assert.equal(target.strokes, 1, "The quoted line has one marker stroke");
    assert.ok(target.aligned, "The marker follows the text through responsive zoom");
    assert.equal(await page.locator(".phile-body-pre").innerHTML(), html, "Highlighting preserves article markup");
    await page.setViewportSize({ width: width === 1280 ? 960 : 390, height: 800 });
    await settleTextLayout(page);
    assert.ok((await highlighted(page)).aligned, "An active marker stays aligned after resizing");
    await page.waitForFunction(() => !CSS.highlights.has("entropic-fragment"));
    assert.equal(await page.locator(".fragment-marker").count(), 0, "The temporary marker is removed after fading");

    await page.goto(repeatedUrl);
    assert.equal((await highlighted(page)).text, "-1", "A new fragment restores its own passage");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator(".fragment-marker").count(), 0, "Reader input dismisses the marker");

    await page.goto(new URL(`${route}#cite=this-passage-was-removed`, baseUrl).href);
    const notice = page.locator("[data-fragment-status]");
    await notice.filter({ hasText: "The linked passage has changed." }).waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => CSS.highlights.has("entropic-fragment")), false);
    await context.close();
    console.log(
      `PASS ${browserName} ${width}px: native link copy, shared selection, contextual links, navigation, highlight cleanup`
    );
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: browserName === "chromium",
    reducedMotion: "reduce"
  });
  await stubExternalResources(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("/volume/0/netgear-exs27-0/", baseUrl).href);
  const codeUrl = await openLink(page, "00 02 00 00 88 df 74 2f");
  await page.goto("about:blank");
  await page.goto(codeUrl);
  assert.equal((await highlighted(page)).text, "00 02 00 00 88 df 74 2f", "A quote crosses ANSI spans");
  await page.goto(new URL("/volume/1/csapp/", baseUrl).href);
  await settleTextLayout(page);
  const cjk = "不开心，不想说话";
  await selectArticleText(page, cjk);
  const trigger = page.locator("[data-fragment-trigger]");
  await trigger.tap();
  const field = page.getByRole("textbox", { name: "Link to selected text" });
  await field.waitFor({ state: "visible" });
  const cjkUrl = await field.inputValue();
  await field.tap();
  assert.deepEqual(await field.evaluate((node) => [node.selectionStart, node.selectionEnd]), [0, cjkUrl.length]);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.goto("about:blank");
  await page.goto(cjkUrl);
  const cjkTarget = await highlighted(page);
  assert.equal(cjkTarget.text, cjk, "CJK bitmap spans retain searchable original text");
  assert.ok(cjkTarget.aligned, "The marker follows the bitmap glyph boxes");
  const acrossBlocks = await page.evaluate(async () => {
    const [first, second] = document.querySelectorAll(".phile-body-pre");
    const range = document.createRange();
    range.setStart(first, first.childNodes.length - 1);
    range.setEnd(second.firstChild, Math.min(80, second.firstChild.length));
    window.scrollBy(0, range.getBoundingClientRect().top - innerHeight / 3);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    return range.toString().replace(/\s+/gu, "");
  });
  await trigger.tap();
  await field.waitFor({ state: "visible" });
  const blocksUrl = await field.inputValue();
  await page.goto("about:blank");
  await page.goto(blocksUrl);
  assert.equal(
    (await highlighted(page)).text.replace(/\s+/gu, ""),
    acrossBlocks,
    "Element boundaries and separate text blocks share one quote index"
  );
  await context.close();
  console.log(`PASS ${browserName} touch: ANSI and CJK passages, URL selection, viewport bounds`);
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
