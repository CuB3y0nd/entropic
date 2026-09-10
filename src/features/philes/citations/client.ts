import type { SelectionTool } from "../selection/types";
import { quoteText } from "./limits";

type CitationDocument = ReturnType<typeof import("./document").createCitationDocument>;
type CitationMarker = ReturnType<typeof import("./marker").createCitationMarker>;

export function createCitationTool(root: HTMLElement): SelectionTool | null {
  const trigger = root.querySelector<HTMLButtonElement>("[data-fragment-trigger]");
  const panel = root.querySelector<HTMLElement>("[data-fragment-panel]");
  const value = panel?.querySelector<HTMLTextAreaElement>("[data-fragment-url]");
  const field = panel?.querySelector<HTMLElement>("[data-fragment-field]");
  const size = field?.querySelector<HTMLElement>("[data-fragment-url-size]");
  const message = panel?.querySelector<HTMLElement>("[data-fragment-message]");
  const article = document.querySelector<HTMLElement>(".phile-wrap");
  const status = document.querySelector<HTMLElement>("[data-fragment-status]");
  if (!trigger || !panel || !value || !field || !size || !message || !article || !status) return null;
  let index: Promise<CitationDocument> | null = null;
  const load = (): Promise<CitationDocument> => {
    index ??= import("./document")
      .then(({ createCitationDocument }) => createCitationDocument(article))
      .catch((error) => {
        index = null;
        throw error;
      });
    return index;
  };
  let navigation = 0;
  let fadeTimer = 0;
  let clearTimer = 0;
  let observer: ResizeObserver | null = null;
  let marker: CitationMarker | null = null;
  let navigationEvents: AbortController | null = null;
  const clear = (): void => {
    clearTimeout(fadeTimer);
    clearTimeout(clearTimer);
    navigationEvents?.abort();
    navigationEvents = null;
    observer?.disconnect();
    observer = null;
    marker?.remove();
    marker = null;
    CSS.highlights?.delete("entropic-fragment");
    article.classList.remove("fragment-target");
    status.hidden = true;
  };
  const interrupt = (): void => {
    navigation++;
    clear();
  };
  const restore = async (): Promise<void> => {
    const revision = ++navigation;
    clear();
    const fragment = location.hash;
    if (!fragment.startsWith("#cite=")) return;
    navigationEvents = new AbortController();
    for (const type of ["pointerdown", "wheel", "keydown"]) {
      document.addEventListener(type, interrupt, { passive: true, signal: navigationEvents.signal });
    }
    try {
      const [documentIndex, { createCitationMarker }] = await Promise.all([load(), import("./marker")]);
      if (revision !== navigation) return;
      const target = documentIndex.resolve(fragment);
      if (!target) return;
      if (target.status !== "found") {
        status.className = "fragment-notice";
        status.textContent =
          target.status === "invalid"
            ? "This fragment link is invalid."
            : target.status === "ambiguous"
              ? "This passage is no longer unique."
              : "The linked passage has changed.";
        status.hidden = false;
        clearTimer = window.setTimeout(clear, 6000);
        return;
      }
      await document.fonts.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (revision !== navigation) return;
      marker = createCitationMarker(article, target.range);
      const position = (): void => {
        if (revision !== navigation) return;
        const rect = target.range.getBoundingClientRect();
        const delta = rect.top - Math.min(innerHeight * 0.28, 200);
        if (Math.abs(delta) > 1) window.scrollBy(0, delta);
        marker?.update();
      };
      position();
      if (typeof Highlight === "function" && CSS.highlights) {
        CSS.highlights.set("entropic-fragment", new Highlight(target.range));
      }
      article.classList.add("fragment-target");
      status.className = "sr-only";
      status.textContent = `Linked passage: ${target.range.toString().replace(/\s+/gu, " ").trim().slice(0, 160)}`;
      status.hidden = false;
      // Keep the target in place while the initial font/grid fit settles. Any
      // reader input cancels this, so late layout never drags them back.
      observer = new ResizeObserver(position);
      observer.observe(article);
      fadeTimer = window.setTimeout(() => {
        observer?.disconnect();
        observer = null;
        article.classList.remove("fragment-target");
        clearTimer = window.setTimeout(clear, 600);
      }, 2600);
    } catch {
      if (revision !== navigation) return;
      clear();
      status.className = "fragment-notice";
      status.textContent = "The linked passage could not be opened.";
      status.hidden = false;
      clearTimer = window.setTimeout(clear, 6000);
    }
  };
  window.addEventListener("hashchange", () => void restore());
  void restore();

  value.addEventListener("click", () => value.select());
  value.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      value.select();
    }
  });
  return {
    trigger,
    panel,
    prepare({ range, text }) {
      if (!quoteText(text)) return null;
      return {
        async show(signal) {
          try {
            const documentIndex = await load();
            if (signal.aborted) return;
            const fragment = documentIndex.fragment(range);
            message.hidden = !!fragment;
            field.hidden = !fragment;
            message.textContent = "Select a longer passage to make the link unambiguous.";
            const url = new URL(location.pathname, location.origin);
            url.hash = fragment ?? "";
            value.value = fragment ? url.href : "";
            size.textContent = value.value;
            value.scrollTop = 0;
          } catch {
            if (signal.aborted) return;
            field.hidden = true;
            message.hidden = false;
            message.textContent = "Couldn't prepare this link. Try again.";
          }
        }
      };
    }
  };
}
