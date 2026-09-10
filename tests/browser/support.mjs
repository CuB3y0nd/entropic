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

export async function selectArticleText(page, text, selector = ".phile-body-pre") {
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
