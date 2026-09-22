import assert from "node:assert/strict";
import { baseUrl, browserName, launchBrowser, settleTextLayout, stubExternalResources } from "./support.mjs";

const browser = await launchBrowser();
try {
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, reducedMotion: "reduce" });
    await stubExternalResources(context);
    const ordinary = await context.newPage();
    const math = await context.newPage();
    await ordinary.goto(new URL("/volume/1/cross-isas/", baseUrl).href);
    await math.goto(new URL("/volume/1/calculus-notes/", baseUrl).href);
    for (const width of [390, 320, 470, 760, 1280, 390]) {
      for (const page of [ordinary, math]) {
        await page.setViewportSize({ width, height: 844 });
        if (javaScriptEnabled) await settleTextLayout(page);
      }
      const normalZoom = await ordinary.locator(".phile-wrap").evaluate((el) => getComputedStyle(el).zoom);
      const state = await math.locator(".phile-wrap").evaluate((el) => ({
        zoom: getComputedStyle(el).zoom,
        width: el.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth,
        clipped: [...el.querySelectorAll(".phile-math-inline")].some((inline) => {
          const formula = inline.querySelector("math").getBoundingClientRect();
          const box = inline.getBoundingClientRect();
          // Only genuinely long formulas may need their own scroll area.
          const available = inline.parentElement.getBoundingClientRect().width;
          return formula.width < available - 1 && formula.width > box.width + 1;
        })
      }));
      const label = `${browserName} ${width}px JS=${javaScriptEnabled}`;
      assert.equal(state.zoom, normalZoom, `${label}: math uses ordinary article scaling`);
      assert.equal(state.overflow, false, `${label}: no page overflow`);
      assert.equal(state.clipped, false, `${label}: inline formulas retain their full width`);
      if (width <= 760) assert.ok(Math.abs(state.width - width) < 1, `${label}: flow fills the viewport`);
    }
    await context.close();
    console.log(`PASS ${browserName}: math scale, inline widths and resize with JS=${javaScriptEnabled}`);
  }
} finally {
  await browser.close();
}
