import assert from "node:assert/strict";
import sharp from "sharp";
import { baseUrl, browserName, launchBrowser, settleTextLayout } from "./support.mjs";

const browser = await launchBrowser();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference"
  });
  await page.goto(new URL("/volume/0/", baseUrl).href);
  await page.locator(".ascii-particles span").first().waitFor({ state: "attached" });
  for (const width of [1280, 390, 320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await settleTextLayout(page);
    await assertCrispEdges(page);
  }
  console.log(`PASS ${browserName}: crisp, complete hairlines at desktop and mobile widths`);

  await page.goto(new URL("/volume/2/", baseUrl).href);
  await page.locator(".ascii-particles span").first().waitFor({ state: "attached" });
  await page.waitForFunction(() => document.querySelector("[data-volume-decoration]").hasAttribute("data-active"));
  const motions = await page.locator(".study-steam").evaluateAll((steams) =>
    steams.map((steam) => {
      const animation = steam.getAnimations()[0];
      animation.pause();
      let previous;
      let heldFrames = 0;
      let longestHold = 0;
      const positions = new Set();
      // Sample browser-computed frames within the active movement, independently of machine load.
      for (let time = 600; time < 2200; time += 1000 / 60) {
        animation.currentTime = time;
        const transform = getComputedStyle(steam).transform;
        positions.add(transform);
        heldFrames = transform === previous ? heldFrames + 1 : 0;
        longestHold = Math.max(longestHold, heldFrames);
        previous = transform;
      }
      animation.play();
      return { positions: positions.size, longestHoldMs: (longestHold * 1000) / 60 };
    })
  );
  assert.ok(
    motions.length > 0 && motions.every((motion) => motion.positions > 80 && motion.longestHoldMs < 50),
    `Steam jumps between held frames: ${JSON.stringify(motions)}`
  );
  console.log(`PASS ${browserName}: continuous steam movement without stepped holds`);
} finally {
  await browser.close();
}

async function assertCrispEdges(page) {
  // Inspect all four edges: a hairline must neither blur nor vanish under mobile zoom.
  const reference = await page.locator(".circuit-package").evaluate((path) => {
    const box = path.getBBox();
    const svg = path.ownerSVGElement;
    const rect = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    const rgb = (value) =>
      value
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    const points = [
      [box.x, box.y + box.height * 0.43, "vertical"],
      [box.x + box.width, box.y + box.height * 0.43, "vertical"],
      [box.x + box.width * 0.43, box.y, "horizontal"],
      [box.x + box.width * 0.43, box.y + box.height, "horizontal"]
    ];
    return {
      // Firefox's getScreenCTM omits ancestor CSS zoom; use the actual viewport rectangle.
      points: points.map(([x, y, axis]) => ({
        x: rect.left + ((x - view.x) * rect.width) / view.width,
        y: rect.top + ((y - view.y) * rect.height) / view.height,
        axis
      })),
      ink: rgb(getComputedStyle(path).color),
      paper: rgb(getComputedStyle(document.body).backgroundColor)
    };
  });
  const { data, info } = await sharp(await page.screenshot())
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channel = reference.ink
    .map((ink, index) => Math.abs(ink - reference.paper[index]))
    .reduce((best, value, index, differences) => (value > differences[best] ? index : best), 0);
  for (const point of reference.points) {
    const coverage = Array.from({ length: 5 }, (_, i) => {
      const x = Math.floor(point.x) + (point.axis === "vertical" ? i - 2 : 0);
      const y = Math.floor(point.y) + (point.axis === "horizontal" ? i - 2 : 0);
      const pixel = data[(y * info.width + x) * info.channels + channel];
      return (pixel - reference.paper[channel]) / (reference.ink[channel] - reference.paper[channel]);
    });
    assert.ok(Math.max(...coverage) > 0.94, `Hairline faded or vanished at ${info.width}px: ${coverage}`);
  }
}
