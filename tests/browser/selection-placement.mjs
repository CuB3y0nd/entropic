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
const overlaps = (first, second) =>
  first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;

try {
  for (const [width, height, hasTouch] of [
    [390, 844, true],
    [320, 568, true],
    [760, 360, true],
    [1280, 800, false]
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch, reducedMotion: "reduce" });
    await stubExternalResources(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    for (const targetY of [20, height / 2, height - 36]) {
      await page.goto(new URL("/volume/3/inspect-field-notes/", baseUrl).href);
      await settleTextLayout(page);
      // Leave scroll room to place this passage at either viewport edge.
      await page.addStyleTag({ content: "body { padding-top: 100vh; }" });
      await selectArticleText(page, "0x2f3", ".phile-body-pre", targetY);
      const trigger = page.locator("[data-inspect-trigger]");
      await trigger.waitFor({ state: "visible" });
      const { selection, actions } = await page.evaluate(() => ({
        selection: getSelection().getRangeAt(0).getBoundingClientRect().toJSON(),
        actions: document.querySelector("[data-selection-actions]").getBoundingClientRect().toJSON()
      }));
      const label = `${width}x${height} selection at ${targetY}`;
      assert.ok(Math.abs(selection.top - targetY) < 1, `${label}: the selection reaches the intended position`);
      assert.ok(actions.left >= 11.9 && actions.right <= width - 11.9, `${label}: tools fit horizontally`);
      assert.ok(actions.top >= 11.9 && actions.bottom <= height - 11.9, `${label}: tools fit vertically`);
      if (hasTouch) {
        // Replay representative native UI bounds based on the Android screenshot.
        // Desktop Playwright does not render the platform selection controls.
        const handles = [
          { left: selection.left - 24, right: selection.left, top: selection.bottom, bottom: selection.bottom + 24 },
          { left: selection.right, right: selection.right + 24, top: selection.bottom, bottom: selection.bottom + 24 }
        ];
        const menuTop = selection.top >= 64 ? selection.top - 52 : selection.bottom + 28;
        const menu = { left: 12, right: width - 12, top: menuTop, bottom: menuTop + 40 };
        assert.equal(
          handles.some((handle) => overlaps(actions, handle)),
          false,
          `${label}: handles leave tools tappable`
        );
        assert.equal(overlaps(actions, menu), false, `${label}: native menu leaves tools tappable`);
        await trigger.tap();
      } else {
        const gap = actions.top >= selection.bottom ? actions.top - selection.bottom : selection.top - actions.bottom;
        assert.ok(Math.abs(gap - 8) < 1, `${label}: mouse selection retains its spacing`);
        await trigger.click();
      }
      const panel = page.getByRole("dialog", { name: "Byte inspector" });
      await panel.waitFor({ state: "visible" });
      assert.equal(
        await page.evaluate(() => getSelection().toString()),
        "0x2f3",
        `${label}: opening preserves selection`
      );
      await page.keyboard.press("Escape");
      await trigger.waitFor({ state: "visible" });
    }
    await context.close();
    console.log(`PASS ${browserName} ${width}x${height}: selection UI clearance, viewport edges and tool opening`);
  }
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
