type Point = readonly [number, number];

function pathThrough(points: Point[]): string {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join("");
}

function branchRoute(points: Point[], branchY: number, tip: number) {
  const route: Point[] = [];
  for (const point of points) {
    const previous = route.at(-1);
    if (previous && point[1] > branchY) {
      const progress = (branchY - previous[1]) / (point[1] - previous[1]);
      route.push([previous[0] + (point[0] - previous[0]) * progress, branchY]);
      break;
    }
    route.push(point);
  }
  const junction = route.at(-1) ?? [tip, branchY];
  const end: Point = [tip, branchY];
  return { path: pathThrough([...route, end]), branch: pathThrough([junction, end]), x: tip, y: branchY };
}

const svgNamespace = "http://www.w3.org/2000/svg";

function svgElement(name: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

/** Keep the circuit attached to the real text after wrapping, font loading, and resizing. */
export function installCveTimeline(timeline: HTMLElement): () => void {
  const art = timeline.querySelector<SVGSVGElement>(".cve-timeline-art");
  if (!art) return () => {};
  let frame = 0;
  let disposed = false;

  const draw = () => {
    frame = 0;
    const bounds = timeline.getBoundingClientRect();
    const compact = window.matchMedia("(max-width: 700px)").matches;
    const scale = Number.parseFloat(getComputedStyle(timeline).fontSize) / 14;
    const center = compact ? 32 * scale : bounds.width / 2;
    const x = (offset: number) => Math.round(center + offset * scale * (compact ? 0.65 : 1)) + 0.5;
    const traces: SVGElement[] = [];
    const accents: SVGElement[] = [];
    const dots: SVGElement[] = [];
    const routes: { path: string; x: number; y: number }[] = [];
    const groups = [...timeline.querySelectorAll<HTMLElement>(".cve-timeline-group")];
    art.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);

    groups.forEach((group, groupIndex) => {
      const heading = group.querySelector("h2")?.getBoundingClientRect();
      if (!heading) return;
      const nextHeading = groups[groupIndex + 1]?.querySelector("h2")?.getBoundingClientRect();
      const start = Math.round(heading.bottom - bounds.top + 5 * scale);
      const end = Math.round(nextHeading ? nextHeading.top - bounds.top - 7 * scale : bounds.height - 2);
      const height = end - start;
      const y = (fraction: number) => Math.round(start + height * fraction) + 0.5;
      const entries = [...group.querySelectorAll<HTMLElement>(".cve-timeline-entry")];
      const long = entries.length > 2;

      // The three conductors use the bends in the reference drawing. Each year's
      // segment stretches between its headings, while branches follow the text.
      const conductors: Point[][] = long
        ? [
            [
              [x(-31), start],
              [x(-31), y(0.09)],
              [x(-20), y(0.09)],
              [x(-20), y(0.46)],
              [x(-34), y(0.46)],
              [x(-34), y(0.63)],
              [x(-21), y(0.63)],
              [x(-21), y(0.88)],
              [x(-12), y(0.88)],
              [x(-12), end]
            ],
            [
              [x(-8), start],
              [x(-8), y(0.31)],
              [x(5), y(0.31)],
              [x(5), y(0.42)],
              [x(-8), y(0.42)],
              [x(-8), y(0.58)],
              [x(5), y(0.58)],
              [x(5), y(0.83)],
              [x(17), y(0.83)],
              [x(17), end]
            ],
            [
              [x(5), start],
              [x(5), y(0.018)],
              [x(18), y(0.045)],
              [x(18), y(0.28)],
              [x(5), y(0.28)],
              [x(5), y(0.52)],
              [x(17), y(0.52)],
              [x(17), y(0.67)],
              [x(5), y(0.7)],
              [x(5), end]
            ]
          ]
        : [
            [
              [x(-20), start],
              [x(-20), y(0.5)],
              [x(groupIndex % 2 === 0 ? -31 : -20), y(0.5)],
              [x(groupIndex % 2 === 0 ? -31 : -20), y(0.64)],
              [x(-20), y(0.64)],
              [x(-20), end]
            ],
            [
              [x(-8), start],
              [x(-8), end]
            ],
            [
              [x(3), start],
              [x(3), y(0.53)],
              [x(groupIndex === groups.length - 1 ? 13 : 3), y(0.53)],
              [x(groupIndex === groups.length - 1 ? 13 : 3), end]
            ]
          ];
      traces.push(...conductors.map((points) => svgElement("path", { d: pathThrough(points) })));

      if (long) {
        const d = `M${x(17)} ${y(0.1)}H${x(5)}V${y(0.43)}H${x(-7)}V${y(0.49)}H${x(-20)}V${y(0.6)}`;
        accents.push(svgElement("path", { d }));
        accents.push(
          svgElement("path", {
            d: `M${x(-20)} ${y(0.57)}H${x(-8)}V${y(0.87)}H${x(0)}V${y(0.97)}`
          })
        );
      }

      entries.forEach((entry, index) => {
        const rect = entry.getBoundingClientRect();
        const lineHeight = Number.parseFloat(getComputedStyle(entry).lineHeight);
        const right = compact || entry.classList.contains("cve-right");
        const branchY = Math.round(rect.top - bounds.top + lineHeight * (long && index === 1 ? 2.2 : 1.45));
        const row = (index >> 1) % 6;
        const reach = !long && !right ? 97 : row === 1 ? 57 : row === 2 || row === 3 ? 83 : 71;
        let edge = compact ? rect.left - bounds.left - 12 * scale : center + (right ? 74 : -reach) * scale;
        for (const text of entry.querySelectorAll("a, p")) {
          const range = document.createRange();
          range.selectNodeContents(text);
          const screenY = bounds.top + branchY + 0.5;
          for (const line of range.getClientRects()) {
            if (screenY < line.top || screenY > line.bottom) continue;
            edge = right
              ? Math.min(edge, line.left - bounds.left - 12 * scale)
              : Math.max(edge, line.right - bounds.left + 12 * scale);
          }
        }
        const conductor = conductors[right ? 2 : 0];
        if (!conductor) return;
        const route = branchRoute(conductor, branchY + 0.5, Math.round(edge));
        traces.push(
          svgElement("path", {
            d: route.branch,
            class: "cve-circuit-branch",
            "data-entry-id": entry.dataset.entryId ?? ""
          })
        );
        routes.push(route);
      });

      if (long || groupIndex === groups.length - 1) {
        const dotX = x(long ? -47 : 27);
        const dotY = long ? y(0.66) : end - 45 * scale;
        for (let row = 0; row < 7; row++) {
          for (let column = 0; column < 4; column++) {
            dots.push(
              svgElement("circle", { cx: dotX + column * 5 * scale, cy: dotY + row * 5 * scale, r: 0.55 * scale })
            );
          }
        }
      }
      if (groupIndex === groups.length - 1) {
        accents.push(svgElement("path", { d: `M${x(-20)} ${y(0.62)}H${x(0)}V${end - 17 * scale}H${x(-8)}` }));
        traces.push(svgElement("path", { d: `M${x(13)} ${end}H${x(21)}` }));
      }
    });

    art.querySelector("[data-cve-timeline-traces]")?.replaceChildren(...traces);
    art.querySelector("[data-cve-timeline-accents]")?.replaceChildren(...accents);
    art.querySelector("[data-cve-timeline-dots]")?.replaceChildren(...dots);
    const selectedRoutes = [...new Set([0, Math.floor((routes.length - 1) / 2), routes.length - 1])].map(
      (index) => routes[index]
    );
    art.querySelectorAll(".cve-signal").forEach((signal, index) => {
      const route = selectedRoutes[index];
      signal.querySelectorAll("path").forEach((path) => {
        path.setAttribute("d", route?.path ?? "");
      });
      const node = signal.querySelector("rect");
      if (!node) return;
      const size = Number(node.getAttribute("width"));
      node.setAttribute("x", String((route?.x ?? 0) - size / 2));
      node.setAttribute("y", String((route?.y ?? 0) - size / 2));
      signal.toggleAttribute("hidden", !route);
    });
    timeline.setAttribute("data-cve-drawn", "");
  };
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(draw);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(timeline);
  for (const entry of timeline.querySelectorAll(".cve-timeline-entry")) observer.observe(entry);
  document.fonts.ready.then(schedule);
  schedule();

  return () => {
    disposed = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
