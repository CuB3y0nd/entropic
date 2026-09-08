import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, settleTextLayout, stubExternalResources } from "./support.mjs";

async function selectText(page, text, selector = ".phile-body-pre") {
  await page.evaluate(
    async ({ text, selector }) => {
      const element = [...document.querySelectorAll(selector)].find((node) => node.textContent.includes(text));
      if (!element) throw new Error(`Missing article text: ${text}`);
      const start = element.textContent.indexOf(text);
      const end = start + text.length;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let offset = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const next = offset + node.textContent.length;
        if (start >= offset && start < next) range.setStart(node, start - offset);
        if (end > offset && end <= next) {
          range.setEnd(node, end - offset);
          break;
        }
        offset = next;
      }
      window.getSelection().removeAllRanges();
      window.scrollBy(0, range.getBoundingClientRect().top - window.innerHeight / 3);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.getSelection().addRange(range);
    },
    { text, selector }
  );
}

const browser = await launchBrowser();
const errors = [];
try {
  for (const width of [1280, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: "reduce" });
    await stubExternalResources(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.copiedValue = null;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.copiedValue = value;
          }
        }
      });
    });
    await page.goto(new URL("/volume/0/netgear-exs27-0/", baseUrl).href);
    await settleTextLayout(page);
    const trigger = page.locator("[data-inspect-trigger]");
    const panel = page.getByRole("dialog", { name: "Byte inspector" });
    const root = page.locator("[data-byte-inspector]");
    assert.equal(await root.isVisible(), false, "Reading alone never opens the inspector");

    await selectText(page, "00 02 00 00");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await panel.waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => window.getSelection().toString()), "00 02 00 00");
    await page.getByRole("button", { name: "Copy UINT LE: 512", exact: true }).click();
    await page.waitForFunction(() => window.copiedValue === "512");
    const box = await panel.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width, "Panel fits the viewport");
    assert.ok(box.y >= 0 && box.y + box.height <= 800, "Panel remains vertically visible");
    assert.equal(
      await panel.evaluate((node) => getComputedStyle(node).fontSize),
      "14px",
      "Article zoom does not shrink tools"
    );

    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    assert.ok(await trigger.evaluate((node) => node === document.activeElement), "Escape returns focus to the trigger");
    await page.keyboard.press("Enter");
    await panel.waitFor({ state: "visible" });
    await page.mouse.click(1, 100);
    await root.waitFor({ state: "hidden" });

    await selectText(page, "00 02 00 00 88 df 74 2f");
    await trigger.waitFor({ state: "visible" });
    await page.keyboard.press("Alt+i");
    await panel.waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-inspect-kind]").textContent(), "/ 8 BYTES", "Selection crosses ANSI spans");
    await page.evaluate(() => window.scrollBy(0, 80));
    await root.waitFor({ state: "hidden" });

    await selectText(page, "0x20000");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    assert.equal(await page.locator("[data-inspect-kind]").textContent(), "/ INTEGER");
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
    await page.getByRole("button", { name: "Copy BIN: 0b100000000000000000", exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector("[data-inspect-status]").textContent.includes("unavailable")
    );
    assert.equal(
      await page.evaluate(() => window.getSelection().toString()),
      "0b100000000000000000",
      "Native copy fallback selects the canonical value"
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => window.getSelection().toString()),
      "0x20000",
      "Closing returns the article selection"
    );

    await page.mouse.click(1, 100);
    await selectText(page, "AES-CBC");
    // Selection handling is debounced until a drag/keyboard selection settles.
    await page.waitForTimeout(250);
    assert.equal(await root.isVisible(), false, "Prose does not activate the inspector");
    await selectText(page, "0", ".phile-header-meta");
    await page.keyboard.press("Alt+i");
    await page.waitForTimeout(250);
    assert.equal(await root.isVisible(), false, "Header metadata is outside the reading tool");

    await context.close();
    console.log(
      `PASS ${browserName} ${width}px: article selection, conversions, copy/fallback, keyboard, dismissal, bounds`
    );
  }
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
