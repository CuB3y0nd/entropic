import assert from "node:assert/strict";
import { chromium, firefox } from "playwright";

export const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:4321");
export const browserName = process.env.PLAYWRIGHT_BROWSER ?? "chromium";

export function launchBrowser() {
  assert.ok(["chromium", "firefox"].includes(browserName), `Unsupported browser: ${browserName}`);
  return (browserName === "firefox" ? firefox : chromium).launch({
    executablePath:
      browserName === "firefox"
        ? process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH
        : process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  });
}

export async function settleTextLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

export function stubExternalResources(context) {
  return context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === baseUrl.origin) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="31"><rect width="88" height="31" fill="#93ffd7"/></svg>'
    });
  });
}
