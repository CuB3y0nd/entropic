import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, stubExternalResources } from "./support.mjs";

const browser = await launchBrowser();
const errors = [];
const expectedText = "CuB3y0nd#6307";

try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      hasTouch: touch,
      viewport: { width: touch ? 320 : 1280, height: 800 },
      ...(browserName === "chromium" ? { permissions: ["clipboard-read", "clipboard-write"] } : {})
    });
    await stubExternalResources(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    if (browserName !== "chromium") {
      await page.addInitScript(() => {
        window.copiedText = null;
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.copiedText = text;
            }
          }
        });
      });
    }
    await page.goto(baseUrl.href);
    if (touch) await page.locator(".badge-toggle").tap();
    const copy = page.getByRole("button", { name: "Copy Discord", exact: true });
    assert.equal(await copy.getAttribute("data-copy-text"), expectedText);
    assert.equal(await copy.getAttribute("href"), null);
    assert.equal(await page.locator(":popover-open").count(), 0);
    const originalUrl = page.url();
    for (const key of touch ? [null] : ["Enter", "Space"]) {
      if (touch) await copy.tap();
      else await copy.press(key);
      await page.waitForFunction(() => document.querySelector(".badge-copy-status")?.textContent === "Copied!");
      const copied = await page.evaluate(() =>
        "copiedText" in window ? window.copiedText : navigator.clipboard.readText()
      );
      assert.equal(copied, expectedText);
      assert.equal(page.url(), originalUrl, "Copying does not navigate");
      assert.equal(await page.locator(":popover-open").count(), 0, "Successful copying needs no dialog");
    }
    await page.waitForFunction(() => document.querySelector(".badge-copy-status")?.textContent === "");

    // Delegation must also read the value of a replacement control.
    const replacementText = "Another user <&>\nsecond line";
    await copy.evaluate((button, text) => {
      const item = button.closest(".badge-item");
      const replacement = item.cloneNode(true);
      replacement.querySelector("button[data-copy-text]").dataset.copyText = text;
      replacement.querySelector("textarea").value = text;
      item.replaceWith(replacement);
    }, replacementText);
    await copy.click();
    await page.waitForFunction(() => document.querySelector(".badge-copy-status")?.textContent === "Copied!");
    assert.equal(
      await page.evaluate(() => ("copiedText" in window ? window.copiedText : navigator.clipboard.readText())),
      replacementText
    );

    for (const failure of ["denied", "unavailable"]) {
      await page.evaluate((mode) => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value:
            mode === "unavailable"
              ? undefined
              : {
                  writeText: async () => {
                    throw new DOMException("Clipboard denied", "NotAllowedError");
                  }
                }
        });
      }, failure);
      await copy.click();
      const dialog = page.locator(".badge-copy-dialog:popover-open");
      await dialog.waitFor({ state: "visible" });
      const textField = dialog.locator("textarea");
      assert.equal(await textField.inputValue(), replacementText);
      assert.deepEqual(
        await textField.evaluate((field) => ({
          focused: field === document.activeElement,
          start: field.selectionStart,
          end: field.selectionEnd
        })),
        { focused: true, start: 0, end: replacementText.length }
      );
      assert.equal(await page.locator(".badge-copy-status").textContent(), "", "Failures never report success");
      const box = await dialog.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= page.viewportSize().width);
      if (failure === "denied") {
        await page.keyboard.press("Escape");
        assert.ok(await copy.evaluate((button) => button === document.activeElement));
      } else {
        await dialog.getByRole("button", { name: "Close" }).click();
      }
      await dialog.waitFor({ state: "hidden" });
      if (touch) {
        assert.equal(
          await page.locator(".badge-dialog").evaluate((element) => element.open),
          true,
          "Closing the copy fallback leaves the gallery open"
        );
      }
    }
    await context.close();
    console.log(
      `PASS ${browserName}: ${touch ? "touch" : "keyboard"} copy, feedback, replaced controls, denied/unavailable fallback`
    );
  }

  const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  await stubExternalResources(noScript);
  const page = await noScript.newPage();
  await page.goto(baseUrl.href);
  await page.getByRole("button", { name: "Copy Discord", exact: true }).click();
  const dialog = page.locator(".badge-copy-dialog:popover-open");
  await dialog.waitFor({ state: "visible" });
  assert.equal(await dialog.locator("textarea").inputValue(), expectedText);
  await dialog.getByRole("button", { name: "Close" }).click();
  await dialog.waitFor({ state: "hidden" });
  await noScript.close();
  console.log(`PASS ${browserName}: selectable copy text without JavaScript`);
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
