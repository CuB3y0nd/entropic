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
  for (const width of [1280, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: "reduce" });
    await stubExternalResources(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("/volume/0/netgear-exs27-0/", baseUrl).href);
    await settleTextLayout(page);
    const trigger = page.locator("[data-inspect-trigger]");
    const panel = page.getByRole("dialog", { name: "Byte inspector" });
    const root = page.locator("[data-byte-inspector]");
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

    await selectText(page, "00 02 00 00");
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

    await selectText(page, "00 02 00 00 88 df 74 2f");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await panel.waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-inspect-kind]").textContent(), "/ 8 BYTES", "Selection crosses ANSI spans");
    await page.evaluate(() => window.scrollBy(0, 80));
    await root.waitFor({ state: "hidden" });

    await selectText(page, "0x20000");
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
    await selectText(page, "AES-CBC");
    // Selection handling is debounced until a drag/keyboard selection settles.
    await page.waitForTimeout(250);
    assert.equal(await root.isVisible(), false, "Prose does not activate the inspector");
    await selectText(page, "0", ".phile-header-meta");
    await page.waitForTimeout(250);
    assert.equal(await root.isVisible(), false, "Header metadata is outside the reading tool");

    await page.goto(new URL("/volume/3/inspect-field-notes/", baseUrl).href);
    await settleTextLayout(page);
    await selectText(page, "-1");
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

    await selectText(page, "-1 < 0U");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    assert.ok(await page.getByRole("button", { name: "Select LEFT: 4294967295", exact: true }).isVisible());
    assert.ok(await page.getByRole("button", { name: "Select RESULT: false", exact: true }).isVisible());
    const comparisonBox = await panel.boundingBox();
    assert.ok(comparisonBox.x >= 0 && comparisonBox.x + comparisonBox.width <= width);
    assert.ok(comparisonBox.y >= 0 && comparisonBox.y + comparisonBox.height <= 800);
    await page.mouse.click(1, 100);

    await selectText(page, "00 80 34 41");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await page.getByRole("combobox", { name: "View", exact: true }).selectOption("float32");
    assert.ok(await page.getByRole("button", { name: "Select VALUE: 11.28125", exact: true }).isVisible());
    await page.getByRole("combobox", { name: "Byte order", exact: true }).selectOption("be");
    assert.ok(await page.getByRole("button", { name: "Select HEX: 0x00803441", exact: true }).isVisible());
    await page.mouse.click(1, 100);

    await selectText(page, "0.1f");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    assert.ok(await page.getByRole("button", { name: "Select VALUE: 0.10000000149011612", exact: true }).isVisible());
    await page.mouse.click(1, 100);

    await selectText(page, "c3 a9");
    await trigger.waitFor({ state: "visible" });
    await trigger.click();
    await page.getByRole("combobox", { name: "View", exact: true }).selectOption("text");
    assert.ok(await page.getByRole("button", { name: 'Select UTF-8: "é"', exact: true }).isVisible());

    await context.close();
    console.log(
      `PASS ${browserName} ${width}px: native copy, width, comparison, endian, floats, text, dismissal, bounds`
    );
  }
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
