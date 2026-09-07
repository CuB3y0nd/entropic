/** Run decorative animation only while its page and optional target are visible. */
export function observeAnimationActivity(onChange: (active: boolean) => void, target?: Element): () => void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let intersectsViewport = target === undefined;
  let pageShown = true;
  let previousActivity: boolean | undefined;

  const update = () => {
    const active = pageShown && !document.hidden && !reducedMotion.matches && intersectsViewport;
    if (active !== previousActivity) {
      previousActivity = active;
      onChange(active);
    }
  };
  const hide = () => {
    pageShown = false;
    update();
  };
  const show = () => {
    pageShown = true;
    update();
  };
  const observer = target
    ? new IntersectionObserver(([entry]) => {
        intersectsViewport = entry?.isIntersecting ?? false;
        update();
      })
    : undefined;

  if (target) observer?.observe(target);
  document.addEventListener("visibilitychange", update);
  reducedMotion.addEventListener("change", update);
  window.addEventListener("pagehide", hide);
  window.addEventListener("pageshow", show);
  update();

  return () => {
    observer?.disconnect();
    document.removeEventListener("visibilitychange", update);
    reducedMotion.removeEventListener("change", update);
    window.removeEventListener("pagehide", hide);
    window.removeEventListener("pageshow", show);
    if (previousActivity) onChange(false);
  };
}
