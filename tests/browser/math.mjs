import assert from "node:assert/strict";
import sharp from "sharp";
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
const route = new URL("/volume/1/calculus-notes/", baseUrl).href;

async function assertSharpProse(page) {
  const starts = await page.evaluate(() => {
    const phrase = "is a continuous function at every point of the interval";
    const paragraph = [...document.querySelectorAll(".phile-paragraph")].find((element) =>
      element.textContent.includes(phrase)
    );
    const text = [...paragraph.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.includes(phrase)
    );
    const range = document.createRange();
    range.selectNodeContents(text);
    return [...range.getClientRects()].map((rect) => rect.x * devicePixelRatio);
  });
  assert.ok(starts.length > 0);
  for (const x of starts)
    assert.ok(Math.abs(x - Math.round(x)) < 0.025, `Prose after inline math is off-grid at ${x}px`);
}

async function assertThinMathRules(page, deviceScaleFactor) {
  const samples = await page
    .locator(".phile-equation")
    .evaluateAll((elements) => [
      elements.findIndex((element) => element.querySelector("annotation")?.textContent.includes("\\cancel{x^{n}}")),
      elements.findIndex((element) => element.querySelector("msqrt"))
    ]);
  for (const index of samples) {
    assert.ok(index >= 0, "Missing fraction or radical sample");
    const equation = page.locator(".phile-equation").nth(index);
    // Exercise pixel rounding independently of the article's current vertical layout.
    for (const offset of [0, 0.25, 0.5, 0.75]) {
      await equation.evaluate((element, top) => {
        element.style.position = "relative";
        element.style.top = `${top}px`;
      }, offset / deviceScaleFactor);
      const { data, info } = await sharp(await equation.screenshot())
        .raw()
        .toBuffer({ resolveWithObject: true });
      const verticalRuns = new Uint16Array(info.width);
      const minimumLength = Math.ceil(45 * deviceScaleFactor);
      let detected = false;
      for (let y = 0; y < info.height; y++) {
        let line = 0;
        let thickLine = 0;
        for (let x = 0; x < info.width; x++) {
          const pixel = (y * info.width + x) * info.channels;
          const bright = data[pixel] > 160 && data[pixel + 1] > 160 && data[pixel + 2] > 160;
          verticalRuns[x] = bright ? verticalRuns[x] + 1 : 0;
          line = bright ? line + 1 : 0;
          thickLine = verticalRuns[x] > Math.ceil(deviceScaleFactor) ? thickLine + 1 : 0;
          detected ||= line >= minimumLength;
          if (thickLine >= minimumLength) {
            assert.fail(`Math rule is too thick in equation ${index} at offset ${offset}`);
          }
        }
      }
      assert.ok(detected, "The screenshot must contain a visible math rule");
    }
    await equation.evaluate((element) => {
      element.style.removeProperty("position");
      element.style.removeProperty("top");
    });
  }
}

async function assertRadicalJoins(page) {
  const proof = page
    .locator(".phile-equation")
    .filter({ has: page.locator("msqrt") })
    .first();
  await proof.evaluate((element) => {
    element.scrollIntoView({ block: "start" });
    scrollBy(0, -180);
  });
  await settleTextLayout(page);
  const roots = await page.locator("msqrt").evaluateAll((elements) =>
    elements
      .map((element) => ({
        bounds: element.getBoundingClientRect().toJSON(),
        join: element.firstElementChild.getBoundingClientRect().x,
        clip: element.closest(".phile-equation, .phile-math-inline").getBoundingClientRect().toJSON()
      }))
      .filter(
        ({ bounds, join, clip }) =>
          bounds.top > 0 &&
          bounds.bottom < innerHeight &&
          bounds.left >= clip.left &&
          join + 6 < Math.min(innerWidth, clip.right)
      )
  );
  assert.ok(roots.length >= 3, "Missing visible radical joins");
  const { data, info } = await sharp(await page.screenshot())
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ink = (x, y) => (data[(y * info.width + x) * info.channels + 1] - 13) / 241;
  for (const { bounds, join } of roots) {
    let barY = 0;
    let maximum = 0;
    for (let y = Math.ceil(bounds.y); y < Math.ceil(bounds.y) + 7; y++) {
      let coverage = 0;
      for (let x = Math.ceil(join) + 2; x < Math.ceil(join) + 6; x++) coverage += ink(x, y);
      if (coverage > maximum) {
        maximum = coverage;
        barY = y;
      }
    }
    assert.ok(maximum > 3, "The radical overbar must be visible");
    let start = Math.ceil(join) + 3;
    while (start > bounds.x && ink(start - 1, barY) > 0.6) start--;
    let run = 0;
    // A displaced glyph cap leaves a horizontal ledge one row below the overbar.
    for (let x = Math.max(Math.floor(bounds.x), start - 7); x < start; x++) {
      run = ink(x, barY + 1) > 0.6 ? run + 1 : 0;
      assert.ok(run <= 1, "The radical corner must not have a displaced horizontal cap");
    }
  }
}

try {
  for (const [width, deviceScaleFactor] of [
    [1280, 1],
    [390, 1],
    [320, 1],
    [1281, 1.25],
    [1280, 1.5],
    [1280, 2]
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      deviceScaleFactor,
      reducedMotion: "reduce"
    });
    await stubExternalResources(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(route, { waitUntil: "networkidle" });
    await settleTextLayout(page);
    // Pixel-font checks require native article scale. Mobile shares the
    // theme's fractional zoom, covered by math-scale.mjs.
    if (width >= 761) {
      await assertSharpProse(page);
      await assertThinMathRules(page, deviceScaleFactor);
      if (deviceScaleFactor === 1) await assertRadicalJoins(page);
    }

    const state = await page.evaluate(() => ({
      formulas: document.querySelectorAll(".phile-math-inline, .phile-equation").length,
      mathml: document.querySelectorAll(".phile-body-flow math").length,
      equations: document.querySelectorAll(".phile-equation").length,
      controls: document.querySelectorAll(".phile-equation button, .phile-equation figcaption").length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      zoom: getComputedStyle(document.querySelector(".phile-math")).zoom,
      mobileScale: getComputedStyle(document.documentElement).getPropertyValue("--mobile-scale").trim(),
      borders: [...document.querySelectorAll(".phile-equation")].some((element) =>
        ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"].some(
          (key) => Number.parseFloat(getComputedStyle(element)[key]) > 0
        )
      )
    }));
    assert.deepEqual(state, {
      formulas: 220,
      mathml: 220,
      equations: 71,
      controls: 0,
      overflow: false,
      zoom: width < 761 ? state.mobileScale : "1",
      mobileScale: state.mobileScale,
      borders: false
    });
    assert.equal(await page.locator(".temml-error, merror").count(), 0);
    const nativeMath = await page.locator("math").evaluateAll((elements) => ({
      fontLoaded: [...document.fonts].some((font) => font.family === "Entropic Math" && font.status === "loaded"),
      visible: elements.every((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return bounds.width > 0 && bounds.height > 0 && style.fontFamily.includes("Entropic Math");
      }),
      inlineSize: getComputedStyle(document.querySelector(".phile-math-inline math")).fontSize,
      displaySize: getComputedStyle(document.querySelector(".phile-equation math")).fontSize
    }));
    assert.deepEqual(nativeMath, { fontLoaded: true, visible: true, inlineSize: "16px", displaySize: "17px" });
    const alignment = await page.evaluate(() => {
      const equation = document.querySelector(".phile-equation");
      const limit = equation.querySelector("munder");
      const proof = [...document.querySelectorAll(".phile-equation math")].find(
        (element) => element.textContent.includes("\\cos") && element.querySelector("mtable")
      );
      return {
        limitOffset: limit.getBoundingClientRect().left - equation.getBoundingClientRect().left,
        equals: [...proof.querySelectorAll("mo")]
          .filter((element) => element.textContent === "=")
          .map((element) => element.getBoundingClientRect().left)
      };
    });
    assert.ok(Math.abs(alignment.limitOffset) < 1, "Display math must remain left aligned");
    assert.equal(alignment.equals.length, 5);
    assert.ok(Math.max(...alignment.equals) - Math.min(...alignment.equals) < 1, "Proof equals signs must align");

    if (width < 400) {
      // Exercise overflow even when the default theme zoom fits every formula.
      const scrollingStyle = await page.addStyleTag({ content: ".phile-equation { max-width: 160px; }" });
      const index = await page
        .locator(".phile-equation")
        .evaluateAll((elements) => elements.findIndex((element) => element.scrollWidth > element.clientWidth + 10));
      assert.ok(index >= 0, "The narrow equation fixture must overflow");
      {
        const equation = page.locator(".phile-equation").nth(index);
        await equation.focus();
        await equation.evaluate((element) => {
          window.equationScrollEnd = new Promise((resolve) =>
            element.addEventListener("scrollend", resolve, { once: true })
          );
        });
        await page.keyboard.press("ArrowRight");
        await page.evaluate(() => window.equationScrollEnd);
        assert.ok(await equation.evaluate((element) => element.scrollLeft > 0));
      }
      await scrollingStyle.evaluate((element) => element.remove());
    }

    const quote = "怎么会有这么简单的定理…";
    await selectArticleText(page, quote, ".phile-paragraph");
    await page.locator("[data-fragment-trigger]").click();
    const field = page.getByRole("textbox", { name: "Link to selected text" });
    await field.waitFor({ state: "visible" });
    const url = await field.inputValue();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => CSS.highlights?.has("entropic-fragment"));
    assert.equal(await page.evaluate(() => [...CSS.highlights.get("entropic-fragment")][0].toString()), quote);

    // A quote spanning an inline formula indexes its visible glyphs once.
    await page.goto(route, { waitUntil: "networkidle" });
    await settleTextLayout(page);
    await page.evaluate(async () => {
      const paragraph = [...document.querySelectorAll(".phile-paragraph")].find((element) =>
        element.textContent.startsWith("假设对于函数")
      );
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      paragraph.scrollIntoView({ block: "center" });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    });
    await page.locator("[data-fragment-trigger]").click();
    await field.waitFor({ state: "visible" });
    const mathQuote = new URLSearchParams(new URL(await field.inputValue()).hash.slice(1)).get("cite");
    assert.equal(mathQuote.replace(/\s/g, ""), "假设对于函数f有：");
    const restoredWidth = width < 400 ? 1281 : 390;
    await page.setViewportSize({ width: restoredWidth, height: 1000 });
    await settleTextLayout(page);
    if (restoredWidth >= 761) await assertSharpProse(page);
    await context.close();
    console.log(
      `PASS ${browserName} ${width}px / DPR ${deviceScaleFactor}: sharp prose, 220 formulas, layout, scrolling and citations`
    );
  }
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
