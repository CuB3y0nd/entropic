export function installMathLayout(): void {
  const formulas = [...document.querySelectorAll<MathMLElement>(".phile-math-inline math")];
  if (formulas.length === 0) return;

  const align = () => {
    const ratio = window.devicePixelRatio;
    // Fractional math advances would blur the bitmap text that follows them.
    const widths = formulas.map((formula) => Math.ceil(formula.getBoundingClientRect().width * ratio) / ratio);
    formulas.forEach((formula, index) => {
      formula.closest<HTMLElement>(".phile-math-inline")?.style.setProperty("width", `${widths[index]}px`);
    });
  };

  // The first layout starts font loading before we wait for its completion.
  align();
  void document.fonts.ready.then(align);
  let pending = false;
  window.addEventListener("resize", () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      align();
    });
  });
}
