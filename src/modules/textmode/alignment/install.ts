const alignedSelector = ".screen > .home-shell, .screen > .textmode-wrap";

export function installTextmodeAlignment(mobileFitBreakpoint: number): void {
  const elements = [...document.querySelectorAll<HTMLElement>(alignedSelector)];
  if (elements.length === 0) {
    return;
  }

  const mobile = window.matchMedia(`(max-width: ${mobileFitBreakpoint}px)`);
  let animationFrame = 0;

  const align = () => {
    // Measure the original layout each time so resize corrections cannot accumulate.
    for (const element of elements) {
      element.style.removeProperty("--pixel-align-x");
      element.style.removeProperty("--pixel-align-y");
    }

    if (mobile.matches) {
      return;
    }

    const ratio = window.devicePixelRatio;
    const offsets = elements.map((element) => {
      const { left, top } = element.getBoundingClientRect();
      return {
        x: Math.round(left * ratio) / ratio - left,
        y: Math.round(top * ratio) / ratio - top
      };
    });

    elements.forEach((element, index) => {
      element.style.setProperty("--pixel-align-x", `${offsets[index].x}px`);
      element.style.setProperty("--pixel-align-y", `${offsets[index].y}px`);
    });
  };

  const scheduleAlignment = () => {
    if (animationFrame !== 0) {
      return;
    }
    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0;
      align();
    });
  };

  const observer = new ResizeObserver(scheduleAlignment);
  observer.observe(document.documentElement);
  for (const element of elements) {
    observer.observe(element);
  }
  window.addEventListener("resize", scheduleAlignment, { passive: true });
  void document.fonts.ready.then(scheduleAlignment);
  scheduleAlignment();
}
