// @ts-check
// This small, self-contained script is inlined as a classic script: select and
// mount artwork during parsing before the fallback can flash or load.
(() => {
  const root = document.currentScript?.parentElement;
  if (!root?.dataset.artworkRotation) return;
  /** @type {import("../artwork/rotation").ArtworkRotation} */
  const rotation = JSON.parse(root.dataset.artworkRotation);
  /** @type {Map<string, HTMLTemplateElement>} */
  const templates = new Map();
  for (const template of root.querySelectorAll("template[data-artwork-id]")) {
    if (template instanceof HTMLTemplateElement && template.dataset.artworkId) {
      templates.set(template.dataset.artworkId, template);
    }
  }
  const ids = [...templates.keys()].sort();
  if (ids.length === 0) return;
  const frame = root.querySelector(".site-badges");
  const panel = root.querySelector(".badge-panel");
  if (!(frame instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;

  const dateFormatter =
    rotation.mode === "daily"
      ? new Intl.DateTimeFormat("en", {
          timeZone: rotation.timeZone,
          calendar: "iso8601",
          numberingSystem: "latn",
          year: "numeric",
          month: "numeric",
          day: "numeric"
        })
      : undefined;
  /** @type {string | undefined} */
  let selectedId;

  /** @param {Date} date */
  function calendarDay(date) {
    const fields = { year: 0, month: 0, day: 0 };
    for (const part of dateFormatter?.formatToParts(date) ?? []) {
      if (part.type === "year" || part.type === "month" || part.type === "day") {
        fields[part.type] = Number(part.value);
      }
    }
    return Math.floor(Date.UTC(fields.year, fields.month - 1, fields.day) / 86_400_000);
  }

  /** @param {string} seed @param {number} cycle */
  function shuffledCycle(seed, cycle) {
    // FNV-1a seeds a deterministic PRNG for the visual rotation schedule.
    let state = 2166136261;
    for (const character of `${seed}\0${cycle}\0${ids.join("\0")}`) {
      state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    const order = [...ids];
    for (let index = order.length - 1; index > 0; index -= 1) {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      const random = ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
      const swapIndex = Math.floor(random * (index + 1));
      const current = order[index];
      const replacement = order[swapIndex];
      if (current !== undefined && replacement !== undefined) {
        order[index] = replacement;
        order[swapIndex] = current;
      }
    }
    return order;
  }

  function chooseArtwork() {
    if (rotation.mode === "visit") {
      return selectedId ?? ids[Math.floor(Math.random() * ids.length)];
    }
    const now = new Date();
    const period =
      rotation.mode === "daily" ? calendarDay(now) : Math.floor(now.getTime() / (rotation.hours * 3_600_000));
    const cycle = Math.floor(period / ids.length);
    const index = ((period % ids.length) + ids.length) % ids.length;
    // With two candidates, a fixed shuffled order gives strict alternation.
    const order = shuffledCycle(rotation.seed, ids.length <= 2 ? 0 : cycle);
    if (ids.length > 2) {
      const previousLast = shuffledCycle(rotation.seed, cycle - 1).at(-1);
      const first = order[0];
      const second = order[1];
      if (first === previousLast && first !== undefined && second !== undefined) {
        // Keep the last item stable when swapping the first two.
        order[0] = second;
        order[1] = first;
      }
    }
    return order[index];
  }

  const updateArtwork = () => {
    const nextId = chooseArtwork();
    if (!nextId || nextId === selectedId) return;
    const template = templates.get(nextId);
    if (!template) return;
    const nextFrame = template.content.querySelector(".site-badges");
    const nextPanel = template.content.querySelector(".badge-panel");
    const nextDecoration = template.content.querySelector(".badge-decoration");
    const decoration = panel.querySelector(".badge-decoration");
    if (!nextFrame || !nextPanel || !nextDecoration || !decoration) return;
    frame.setAttribute("style", nextFrame.getAttribute("style") ?? "");
    panel.setAttribute("data-placement", nextPanel.getAttribute("data-placement") ?? "top");
    panel.toggleAttribute("data-overlap", nextPanel.hasAttribute("data-overlap"));
    // Keep controls connected: focus, selection, popovers, and pending copies
    // belong to the visitor and must survive a calendar change.
    decoration.replaceWith(nextDecoration.cloneNode(true));
    root.dataset.activeArtwork = nextId;
    selectedId = nextId;
  };

  updateArtwork();
  for (const template of templates.values()) template.remove();
  window.addEventListener("pageshow", updateArtwork);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateArtwork();
  });
})();
