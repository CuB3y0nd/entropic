import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { baseUrl, browserName, launchBrowser, settleTextLayout, stubExternalResources } from "./support.mjs";

const browser = await launchBrowser();
const errors = [];
const route = new URL("/volume/3/latex-support/", baseUrl).href;

try {
  for (const javaScriptEnabled of [true, false]) {
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        javaScriptEnabled,
        reducedMotion: "reduce"
      });
      await stubExternalResources(context);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto(route, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200);
      assert.match(await response.text(), /href="#equation-energy">\(1\)<\/a>/);
      if (javaScriptEnabled) await settleTextLayout(page);
      assert.ok(
        await page.evaluate(() =>
          [...document.fonts].some((font) => font.family.includes("Entropic Math") && font.status === "loaded")
        )
      );

      const layout = await page.locator(".phile-equation-row").evaluateAll((rows) =>
        rows.map((row) => {
          const cells = [...row.children];
          const tag = cells.at(-1).lastElementChild.getBoundingClientRect();
          const body = cells.at(-2).getBoundingClientRect();
          const region = row.closest(".phile-equation");
          return {
            id: row.id,
            gap: tag.left - body.right,
            minimum:
              (Number.parseFloat(getComputedStyle(row).fontSize) / 2) *
              (Number.parseFloat(getComputedStyle(row.closest(".phile-wrap")).zoom) || 1),
            tagRight: tag.right,
            rowRight: row.getBoundingClientRect().right,
            regionRight: region.getBoundingClientRect().right,
            scrollWidth: region.scrollWidth,
            width: region.clientWidth
          };
        })
      );
      assert.equal(layout.length, 3);
      for (const row of layout) {
        assert.ok(row.gap >= row.minimum - 0.1, `Insufficient number separation: ${JSON.stringify(row)}`);
        assert.ok(Math.abs(row.tagRight - row.rowRight) < 1, "Numbers align to the display's right edge");
        if (row.id !== "equation-binomial") {
          assert.equal(row.scrollWidth, row.width, "Short numbered equations must fit without scrolling");
          assert.ok(Math.abs(row.tagRight - row.regionRight) < 1, "Short equations use the available width");
        }
      }
      assert.equal(await page.locator(".temml-error, merror").count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

      const references = page.locator(".phile-equation-ref");
      for (const reference of await references.all()) {
        const target = (await reference.getAttribute("href")).slice(1);
        assert.ok((await reference.textContent()).trim());
        await reference.click();
        assert.equal(new URL(page.url()).hash, `#${target}`);
        assert.equal(await page.locator(`[id="${target}"]`).count(), 1);
        const bounds = await page.locator(`[id="${target}"]`).boundingBox();
        assert.ok(bounds.y >= 0 && bounds.y < 1000, `Reference target must be visible: ${target}`);
        if (javaScriptEnabled) {
          const strokes = page.locator(`.phile-equation:has(#${target}) > .target-marker > span`);
          await strokes.first().waitFor();
          const marker = await strokes.evaluateAll((nodes) => ({
            target: nodes[0].closest(".phile-equation").querySelector(".phile-equation-row").id,
            boxes: nodes.map((node) => {
              const rect = node.getBoundingClientRect();
              return { left: rect.left, right: rect.right };
            })
          }));
          assert.equal(marker.target, target);
          assert.equal(marker.boxes.length, 2, "Formula and number receive separate strokes");
          assert.ok(marker.boxes[0].right < marker.boxes[1].left, "The number gap stays unpainted");
        }
      }

      // A link embedded in MathML must remain a real keyboard-accessible HTML link.
      const inline = page.locator("math .phile-equation-ref");
      assert.equal(await inline.evaluate((node) => node.namespaceURI), "http://www.w3.org/1999/xhtml");
      await inline.focus();
      await page.keyboard.press("Enter");
      assert.equal(new URL(page.url()).hash, "#equation-energy");

      if (javaScriptEnabled && width === 1280) {
        const marker = page.locator(".target-marker");
        await marker.waitFor({ state: "attached" });
        await marker.waitFor({ state: "detached", timeout: 4500 });
        await inline.press("Enter");
        await marker.waitFor({ state: "attached" });
        assert.equal(new URL(page.url()).hash, "#equation-energy", "The same target can be highlighted again");

        await page.locator('a[href="#equation-pythagoras"]').click();
        await page.evaluate(() => scrollTo(0, 0));
        await page.reload({ waitUntil: "networkidle" });
        await settleTextLayout(page);
        const reloaded = await page.locator("#equation-pythagoras").boundingBox();
        assert.ok(
          reloaded.y >= 0 && reloaded.y < 1000,
          "Reloading an equation URL restores its target after browser scroll restoration"
        );
      }

      const long = page.locator(".phile-equation:has(#equation-binomial)");
      assert.ok(await long.evaluate((node) => node.scrollWidth > node.clientWidth + 100));
      await long.evaluate((node) => {
        node.scrollLeft = 0;
      });
      await long.focus();
      await page.keyboard.press("ArrowRight");
      // Browser animation callbacks are disabled in the no-JavaScript context.
      for (let attempt = 0; attempt < 40; attempt++) {
        if (await long.evaluate((node) => node.scrollLeft > 0)) break;
        await delay(50);
      }
      assert.ok(await long.evaluate((node) => node.scrollLeft > 0), "Arrow keys scroll the equation");
      await long.evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
      });
      const end = await long.evaluate((node) => ({
        tagRight: node.querySelector(".tml-tag").getBoundingClientRect().right,
        right: node.getBoundingClientRect().right
      }));
      assert.ok(Math.abs(end.tagRight - end.right) < 1, "The long equation's number is reachable by scrolling");
      await context.close();
      console.log(
        `PASS ${browserName} ${width}px / JS ${javaScriptEnabled}: reference navigation, number spacing and scrolling`
      );
    }
  }
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
