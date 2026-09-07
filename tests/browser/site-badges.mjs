import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, settleTextLayout, stubExternalResources } from "./support.mjs";

const browser = await launchBrowser();
const errors = [];
let deployedOrder;
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      hasTouch: touch,
      viewport: { width: touch ? 390 : 1280, height: 800 }
    });
    await stubExternalResources(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of touch ? [390, 320, 760] : [1280, 899]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(baseUrl.href);
      await settleTextLayout(page);
      const panel = page.locator(".site-badges");
      const artwork = panel.locator(".badge-artwork");
      await artwork.scrollIntoViewIfNeeded();
      await artwork.evaluate((image) => image.decode());
      const actions = panel.locator(".badge-action");
      assert.equal(await actions.count(), 17);
      const order = await actions.evaluateAll((elements) =>
        elements.map((element) => element.querySelector("img").src)
      );
      deployedOrder ??= order;
      assert.deepEqual(
        order,
        deployedOrder,
        "A deployment keeps the same order across refreshes, visitors, and viewports"
      );
      const image = await artwork.evaluate((element) => ({
        currentSrc: element.currentSrc,
        alt: element.alt,
        hidden: element.getAttribute("aria-hidden"),
        width: Number(element.getAttribute("width")),
        height: Number(element.getAttribute("height"))
      }));
      assert.ok(image.currentSrc.endsWith(".webp"), "Local artwork uses the build image pipeline");
      assert.equal(image.alt, "");
      assert.equal(image.hidden, "true");
      assert.ok(image.width > 0 && image.height > 0);
      for (const action of await actions.all()) {
        const geometry = await action.boundingBox();
        assert.ok(Math.abs(geometry.width - 88) < 0.01);
        assert.ok(Math.abs(geometry.height - 31) < 0.01);
        assert.ok(geometry.x >= 0 && geometry.x + geometry.width <= width, "Badges remain inside narrow viewports");
        if ((await action.getAttribute("target")) === "_blank") {
          assert.ok((await action.getAttribute("rel")).includes("noopener"));
        }
        await action.focus();
        const reveal = action.locator(".badge-reveal");
        if (await reveal.count()) {
          assert.equal(
            await reveal.evaluate((element) => getComputedStyle(element).opacity),
            "1",
            "Keyboard focus reveals the badge above overlapping art"
          );
        } else {
          assert.notEqual(
            await action.evaluate((element) => getComputedStyle(element).outlineColor),
            "rgba(0, 0, 0, 0)",
            "Keyboard focus remains visible without overlapping art"
          );
        }
        assert.ok(
          await action.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
          }),
          "Decorative artwork never intercepts controls"
        );
      }
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      if (touch) {
        if (await actions.first().locator(".badge-reveal").count()) {
          assert.equal(
            await actions
              .first()
              .locator(".badge-reveal")
              .evaluate((element) => getComputedStyle(element).opacity),
            "1",
            "Touch devices do not require hover to reveal buttons"
          );
        }
        // Prevent external navigation while verifying the first tap activates the real action.
        await actions.first().evaluate((element) =>
          element.addEventListener(
            "click",
            (event) => {
              event.preventDefault();
              element.dataset.activated = "true";
            },
            { once: true }
          )
        );
        await actions.first().tap();
        assert.equal(await actions.first().getAttribute("data-activated"), "true");
      }
      console.log(`PASS ${browserName}: site badges at ${width}px, ${touch ? "touch" : "keyboard"}, optimized artwork`);
    }
    await context.close();
  }
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
