/** Also works for modules imported after the document's load event. */
export function afterPageLoad(callback: () => void): void {
  if (document.readyState === "complete") {
    callback();
  } else {
    window.addEventListener("load", callback, { once: true });
  }
}
