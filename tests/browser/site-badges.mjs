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
    const markup = await context.request.get(baseUrl.href).then((response) => response.text());
    const configuredCount = [...markup.matchAll(/class="badge-action"/g)].length;
    assert.ok(configuredCount > 0, "The page provides configured buttons");
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of touch ? [390, 320, 375, 414, 700, 760] : [1280, 899]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : width === 700 ? 360 : 800 });
      await page.goto(baseUrl.href);
      // The development toolbar is absent from production and can cover the
      // last rows on short phone viewports.
      await page.addStyleTag({ content: "astro-dev-toolbar { display: none; }" });
      await settleTextLayout(page);
      const panel = page.locator(".site-badges");
      const artwork = panel.locator(".badge-artwork");
      const dialog = panel.locator(".badge-dialog");
      const toggle = panel.locator(".badge-toggle");
      await artwork.scrollIntoViewIfNeeded();
      await artwork.evaluate((image) => image.decode());
      const actions = panel.locator(".badge-action");
      assert.equal(await actions.count(), configuredCount, "All configured buttons remain available");
      const order = await actions.evaluateAll((elements) =>
        elements.map((element) => element.querySelector("img").src)
      );
      deployedOrder ??= order;
      assert.deepEqual(order, deployedOrder, "Gallery and viewport changes preserve the deployment's order");
      assert.equal(await panel.locator(".badge-actions").count(), 1, "The gallery shares the original controls");
      const image = await artwork.evaluate((element) => ({
        currentSrc: element.currentSrc,
        alt: element.alt,
        hidden: element.getAttribute("aria-hidden")
      }));
      const artworkUrl = new URL(image.currentSrc);
      assert.ok(
        artworkUrl.pathname.endsWith(".webp") ||
          (artworkUrl.pathname === "/_image" && artworkUrl.searchParams.get("f") === "webp"),
        "Local artwork uses the optimized image pipeline"
      );
      assert.equal(image.alt, "");
      assert.equal(image.hidden, "true");
      if (width <= 760) {
        await toggle.scrollIntoViewIfNeeded();
        assert.equal(await dialog.evaluate((element) => element.open), false, "Mobile starts with the gallery closed");
        assert.equal(await actions.first().isVisible(), false, "Collapsed buttons leave the main content prominent");
        assert.equal(await toggle.locator(".badge-count").textContent(), `(${configuredCount})`);
        assert.ok((await toggle.boundingBox()).height >= 44, "The gallery entry has a generous touch target");
        assert.ok((await panel.boundingBox()).height <= 108.1, "The closed footer stays compact");
        assert.ok((await artwork.boundingBox()).height <= 64.1, "Artwork remains visible at a smaller size");
        const entry = await panel.evaluate((element) => {
          const art = element.querySelector(".badge-decoration").getBoundingClientRect();
          const toggle = element.querySelector(".badge-toggle").getBoundingClientRect();
          const row = element.querySelector(".badge-composition").getBoundingClientRect();
          const glyph = (target) => {
            const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const index = node.textContent.search(/[A-Za-z]/);
              if (index < 0) continue;
              const range = document.createRange();
              range.setStart(node, index);
              range.setEnd(node, index + 1);
              const bounds = range.getBoundingClientRect();
              return { width: bounds.width, height: bounds.height };
            }
          };
          const label = element.querySelector(".badge-toggle-text");
          return {
            gap: toggle.top - art.bottom,
            centerOffset: art.left + art.width / 2 - toggle.left - toggle.width / 2,
            rowOffset: toggle.left + toggle.width / 2 - row.left - row.width / 2,
            bodyGlyph: glyph(document.querySelector(".home-shell > .home-pre")),
            labelGlyph: glyph(label),
            font: getComputedStyle(label).fontFamily
          };
        });
        assert.ok(Math.abs(entry.gap) < 0.1, "The entry sits directly below the decoration");
        assert.ok(Math.abs(entry.centerOffset) < 0.1, "Art and text share a horizontal center");
        assert.ok(Math.abs(entry.rowOffset) < 0.1, "The stacked group is centered beneath the homepage");
        assert.ok(entry.font.includes("gohu"), "The entry uses the site font");
        assert.ok(Math.abs(entry.bodyGlyph.width - entry.labelGlyph.width) < 0.02, "Entry glyphs match body width");
        assert.ok(Math.abs(entry.bodyGlyph.height - entry.labelGlyph.height) < 0.02, "Entry glyphs match body height");
        const before = await page.locator(".home-shell").boundingBox();
        assert.ok((await panel.boundingBox()).width <= before.width + 0.1, "The footer fits the ASCII masthead");
        await toggle.tap();
        await dialog.waitFor({ state: "visible" });
        assert.equal(
          await dialog.evaluate((element) => element.matches(":modal")),
          true,
          "One tap opens the modal gallery"
        );
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        assert.equal(
          await panel.locator(".badge-dialog-close").evaluate((element) => element === document.activeElement),
          true
        );
        assert.ok(await actions.first().isVisible());
        const after = await page.locator(".home-shell").boundingBox();
        assert.deepEqual(after, before, "Opening the gallery does not move or resize the homepage");
        const bounds = await dialog.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, "The gallery fits the viewport");
        assert.ok(
          bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height,
          "Short screens scroll inside the gallery"
        );
        const columns = await actions.evaluateAll(
          (elements) => new Set(elements.map((element) => element.getBoundingClientRect().left)).size
        );
        assert.equal(columns, Math.min(configuredCount, 3), "The gallery uses three native-size columns");
        assert.equal(await panel.locator(".badge-artwork").count(), 1, "The decoration is not duplicated on expansion");
      } else {
        assert.equal(await dialog.evaluate((element) => element.open), false);
        assert.ok(await actions.first().isVisible(), "Desktop buttons remain visible");
        assert.equal(await toggle.isVisible(), false, "Desktop needs no disclosure control");
      }
      // Switch from tapping the gallery entry to real keyboard input before
      // checking :focus-visible; programmatic focus alone keeps touch modality.
      await page.keyboard.press("Tab");
      for (const action of await actions.all()) {
        await action.focus();
        const geometry = await action.boundingBox();
        assert.ok(Math.abs(geometry.width - 88) < 0.01);
        assert.ok(Math.abs(geometry.height - (width <= 760 ? 44 : 31)) < 0.01);
        const badge = await action.locator(":scope > img").boundingBox();
        assert.ok(Math.abs(badge.width - 88) < 0.01 && Math.abs(badge.height - 31) < 0.01);
        assert.ok(geometry.x >= 0 && geometry.x + geometry.width <= width, "Buttons stay inside the viewport");
        if ((await action.getAttribute("target")) === "_blank") {
          assert.ok((await action.getAttribute("rel")).includes("noopener"));
        }
        const reveal = action.locator(".badge-reveal");
        if (await reveal.isVisible()) {
          assert.equal(await reveal.evaluate((element) => getComputedStyle(element).opacity), "1");
        } else {
          assert.notEqual(
            await action.evaluate((element) => getComputedStyle(element).outlineColor),
            "rgba(0, 0, 0, 0)",
            "Keyboard focus remains visible"
          );
        }
        assert.ok(
          await action.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
          }),
          "Every button can scroll into view and decorations never intercept it"
        );
      }
      if (touch) {
        assert.equal(
          await page.locator(".screen").evaluate((screen) => screen.scrollTop),
          0,
          "The page scrolls without a nested panel"
        );
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
        await actions.first().tap({ position: { x: 44, y: 2 } });
        assert.equal(
          await actions.first().getAttribute("data-activated"),
          "true",
          "The larger touch target activates on its first tap"
        );
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () => document.querySelector(".badge-toggle").getAttribute("aria-expanded") === "false"
        );
        assert.equal(
          await toggle.evaluate((element) => element === document.activeElement),
          true,
          "Closing restores focus to the entry"
        );
        assert.equal(await actions.first().isVisible(), false);
        await toggle.press("Enter");
        await dialog.waitFor({ state: "visible" });
        await panel.locator(".badge-dialog-close").tap();
        await page.waitForFunction(
          () => document.querySelector(".badge-toggle").getAttribute("aria-expanded") === "false"
        );
        await toggle.press("Space");
        await dialog.waitFor({ state: "visible" });
        await page.touchscreen.tap(4, 4);
        await page.waitForFunction(
          () => document.querySelector(".badge-toggle").getAttribute("aria-expanded") === "false"
        );
        assert.equal(
          await actions.first().isVisible(),
          false,
          "Escape, close button and backdrop all dismiss the gallery"
        );
      }
      console.log(
        `PASS ${browserName}: buttons at ${width}px, ${touch ? "gallery, alignment and touch" : "desktop keyboard"}`
      );
    }
    if (touch) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await settleTextLayout(page);
      assert.ok(await page.locator(".badge-action").last().isVisible());
      await page.setViewportSize({ width: 390, height: 800 });
      await settleTextLayout(page);
      assert.equal(
        await page.locator(".badge-dialog").evaluate((element) => element.open),
        false,
        "Returning to mobile preserves the closed state"
      );
      await page.locator(".badge-toggle").tap();
      await settleTextLayout(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await settleTextLayout(page);
      await page.waitForFunction(() => document.querySelector(".badge-browser > .badge-actions"));
      assert.equal(await page.locator(".badge-dialog").evaluate((element) => element.open), false);
      assert.ok(await page.locator(".badge-action").last().isVisible(), "Desktop restores the original controls");
      await page.setViewportSize({ width: 390, height: 800 });
      await settleTextLayout(page);
      assert.equal(
        await page.locator(".badge-dialog").evaluate((element) => element.open),
        false,
        "Returning from desktop starts with a compact mobile footer"
      );
    }
    await context.close();
  }
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
