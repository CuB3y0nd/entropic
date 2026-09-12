export function installCredits(): void {
  const popovers = document.querySelectorAll<HTMLElement>("[data-phile-credits]");
  if (popovers.length === 0) return;
  for (const popover of popovers) {
    const list = popover.querySelector("ol");
    if (!list) continue;
    list.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey) return;
        // Firefox can pass a fresh wheel gesture at either edge to the page.
        const atStart = event.deltaY < 0 && list.scrollTop <= 0;
        const atEnd = event.deltaY > 0 && list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
        if (atStart || atEnd) event.preventDefault();
      },
      { passive: false }
    );
  }
  let anchor: HTMLElement | undefined;
  let panel: HTMLElement | undefined;
  let positionQueued = false;

  const position = () => {
    if (!anchor || !panel?.matches(":popover-open")) return;
    const target = anchor.getBoundingClientRect();
    const bounds = panel.getBoundingClientRect();
    const scale = Number.parseFloat(getComputedStyle(panel).zoom);
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
    const topEdge = (viewport?.offsetTop ?? 0) + 12;
    const rightEdge = leftEdge + (viewport?.width ?? innerWidth) - 24;
    const bottomEdge = topEdge + (viewport?.height ?? innerHeight) - 24;
    // DOM bounds are in viewport pixels; inset lengths follow the panel's zoom.
    panel.style.left = `${Math.max(leftEdge, Math.min(target.right - bounds.width, rightEdge - bounds.width)) / scale}px`;
    panel.style.top = `${Math.max(topEdge, Math.min(target.bottom + 8, bottomEdge - bounds.height)) / scale}px`;
  };
  const close = () => {
    if (panel?.matches(":popover-open")) panel.hidePopover();
  };
  const schedulePosition = () => {
    if (positionQueued || !panel?.matches(":popover-open")) return;
    positionQueued = true;
    // Article fitting settles on the first animation frame after resizing.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        positionQueued = false;
        position();
      })
    );
  };

  document.addEventListener("click", (event) => {
    const trigger =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-credits-trigger]") : null;
    if (!trigger) return;
    const target = document.getElementById(trigger.getAttribute("popovertarget") ?? "");
    if (!target) return;
    event.preventDefault();
    if (panel !== target) close();
    panel = target;
    anchor = trigger;
    panel.togglePopover();
    position();
  });
  window.addEventListener("resize", schedulePosition, { passive: true });
  window.addEventListener("scroll", close, { passive: true });
  window.visualViewport?.addEventListener("resize", schedulePosition, { passive: true });
}
