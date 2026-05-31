const lightboxClass = "image-lightbox";
const openClass = "image-lightbox-open";

type LightboxElements = {
  dialog: HTMLDialogElement;
  image: HTMLImageElement;
  caption: HTMLElement;
};

type LightboxTransform = {
  scale: number;
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

type TapState = {
  targetIsImage: boolean;
  moved: boolean;
};

type PinchState = {
  startDistance: number;
  startScale: number;
  baseCenterX: number;
  baseCenterY: number;
  contentX: number;
  contentY: number;
};

const minScale = 0.12;
const maxScale = 8;
const wheelScaleStep = 0.002;
const dragSuppressDistance = 4;
const pinchSensitivity = 1.35;
const clickSuppressMs = 280;

let activeTrigger: HTMLElement | undefined;
let transform: LightboxTransform = { scale: 1, x: 0, y: 0 };
let dragState: DragState | undefined;
let pinchState: PinchState | undefined;
let tapState: TapState | undefined;
let suppressClickUntil = 0;
let boundLightbox: LightboxElements | undefined;

export function installImageLightbox(root: ParentNode = document): void {
  const triggers = root.querySelectorAll<HTMLElement>("[data-lightbox-image]");

  if (triggers.length === 0) {
    return;
  }

  const lightbox = ensureLightbox();

  for (const trigger of triggers) {
    if (trigger.dataset.lightboxReady === "true") {
      continue;
    }

    trigger.dataset.lightboxReady = "true";
    trigger.addEventListener("click", () => openLightbox(trigger, lightbox));
  }
}

function ensureLightbox(): LightboxElements {
  const existing = document.querySelector<HTMLDialogElement>(`.${lightboxClass}`);

  if (existing) {
    const lightbox = {
      dialog: existing,
      image: requireElement(existing, ".image-lightbox-image", HTMLImageElement),
      caption: requireElement(existing, ".image-lightbox-caption", HTMLElement)
    };

    boundLightbox = lightbox;
    return lightbox;
  }

  const dialog = document.createElement("dialog");
  dialog.className = lightboxClass;
  dialog.setAttribute("aria-label", "Image preview");
  dialog.tabIndex = -1;
  dialog.innerHTML = [
    '<figure class="image-lightbox-frame">',
    '<img class="image-lightbox-image" alt="" decoding="async" draggable="false" />',
    '<figcaption class="image-lightbox-caption"></figcaption>',
    "</figure>"
  ].join("");

  document.body.append(dialog);

  const lightbox = {
    dialog,
    image: requireElement(dialog, ".image-lightbox-image", HTMLImageElement),
    caption: requireElement(dialog, ".image-lightbox-caption", HTMLElement)
  };

  boundLightbox = lightbox;
  document.addEventListener("click", suppressSyntheticClick, true);
  dialog.addEventListener("click", (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.target !== lightbox.image) {
      event.preventDefault();
      event.stopPropagation();
      closeLightbox(lightbox);
    }
  });
  dialog.addEventListener("wheel", (event) => zoomImage(event, lightbox), { passive: false });
  dialog.addEventListener("pointerdown", (event) => startPointerDrag(event, lightbox));
  dialog.addEventListener("pointermove", (event) => movePointerDrag(event, lightbox));
  dialog.addEventListener("pointerup", (event) => stopPointerDrag(event, lightbox));
  dialog.addEventListener("pointercancel", (event) => stopPointerDrag(event, lightbox));
  dialog.addEventListener("touchstart", (event) => startTouch(event, lightbox), { passive: false });
  dialog.addEventListener("touchmove", (event) => moveTouch(event, lightbox), { passive: false });
  dialog.addEventListener("touchend", (event) => stopTouch(event, lightbox), { passive: false });
  dialog.addEventListener("touchcancel", (event) => stopTouch(event, lightbox), { passive: false });
  dialog.addEventListener("cancel", () => resetLightbox());
  dialog.addEventListener("close", () => resetLightbox());

  return lightbox;
}

function openLightbox(trigger: HTMLElement, lightbox: LightboxElements): void {
  const source = trigger.querySelector<HTMLImageElement>("img");

  if (!source) {
    return;
  }

  activeTrigger = trigger;
  lightbox.image.src = source.currentSrc || source.src;
  lightbox.image.alt = source.alt;
  lightbox.caption.textContent = source.alt;
  lightbox.caption.hidden = source.alt.trim().length === 0;
  transform = { scale: 1, x: 0, y: 0 };
  applyImageTransform(lightbox);
  document.body.classList.add(openClass);
  if (!lightbox.dialog.open) {
    lightbox.dialog.showModal();
  }
  lightbox.dialog.focus({ preventScroll: true });
}

function closeLightbox(lightbox: LightboxElements): void {
  resetLightbox();

  if (lightbox.dialog.open) {
    lightbox.dialog.close();
  }
}

function resetLightbox(): void {
  document.body.classList.remove(openClass);
  dragState = undefined;
  pinchState = undefined;
  tapState = undefined;
  suppressClickUntil = 0;
  lightboxImageClassList()?.remove("image-lightbox-image-dragging");
  activeTrigger?.focus({ preventScroll: true });
  activeTrigger = undefined;
}

function zoomImage(event: WheelEvent, lightbox: LightboxElements): void {
  event.preventDefault();

  scaleImageAt(lightbox, event.clientX, event.clientY, transform.scale * (1 - event.deltaY * wheelScaleStep));
}

function startPointerDrag(event: PointerEvent, lightbox: LightboxElements): void {
  if (event.pointerType === "touch") {
    event.preventDefault();
    return;
  }

  if (event.target !== lightbox.image) {
    dragState = undefined;
    return;
  }

  event.preventDefault();
  capturePointer(lightbox.dialog, event.pointerId);

  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: transform.x,
    originY: transform.y,
    moved: false
  };
  lightbox.image.classList.add("image-lightbox-image-dragging");
}

function movePointerDrag(event: PointerEvent, lightbox: LightboxElements): void {
  if (event.pointerType === "touch") {
    event.preventDefault();
    return;
  }

  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  event.preventDefault();
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;

  if (Math.hypot(dx, dy) > dragSuppressDistance) {
    dragState.moved = true;
    suppressClick();
  }

  transform = {
    ...transform,
    x: dragState.originX + dx,
    y: dragState.originY + dy
  };
  applyImageTransform(lightbox);
}

function stopPointerDrag(event: PointerEvent, lightbox: LightboxElements): void {
  if (event.pointerType === "touch") {
    event.preventDefault();
    return;
  }

  releasePointer(lightbox.dialog, event.pointerId);

  if (dragState?.moved) {
    suppressClick();
  }

  dragState = undefined;
  lightbox.image.classList.remove("image-lightbox-image-dragging");
}

function startTouch(event: TouchEvent, lightbox: LightboxElements): void {
  event.preventDefault();

  if (event.touches.length >= 2) {
    tapState = undefined;
    dragState = undefined;
    startTouchPinch(event, lightbox);
    return;
  }

  const touch = event.touches[0];

  if (!touch) {
    return;
  }

  const targetIsImage = event.target === lightbox.image;
  tapState = {
    targetIsImage,
    moved: false
  };

  if (!targetIsImage) {
    dragState = undefined;
    return;
  }

  dragState = {
    pointerId: touch.identifier,
    startX: touch.clientX,
    startY: touch.clientY,
    originX: transform.x,
    originY: transform.y,
    moved: false
  };
  lightbox.image.classList.add("image-lightbox-image-dragging");
}

function moveTouch(event: TouchEvent, lightbox: LightboxElements): void {
  event.preventDefault();

  if (event.touches.length >= 2) {
    tapState = undefined;

    if (!pinchState) {
      startTouchPinch(event, lightbox);
    }

    pinchImageFromMetrics(lightbox, touchMetrics(event));
    return;
  }

  const touch = event.touches[0];

  if (!touch || !dragState || touch.identifier !== dragState.pointerId) {
    return;
  }

  const dx = touch.clientX - dragState.startX;
  const dy = touch.clientY - dragState.startY;

  if (Math.hypot(dx, dy) > dragSuppressDistance) {
    dragState.moved = true;
    if (tapState) {
      tapState.moved = true;
    }
    suppressClick();
  }

  transform = {
    ...transform,
    x: dragState.originX + dx,
    y: dragState.originY + dy
  };
  applyImageTransform(lightbox);
}

function stopTouch(event: TouchEvent, lightbox: LightboxElements): void {
  event.preventDefault();

  if (pinchState) {
    suppressClick();
    pinchState = undefined;
  }

  if (event.touches.length >= 2) {
    startTouchPinch(event, lightbox);
    return;
  }

  if (event.touches.length === 1) {
    const touch = event.touches[0];
    dragState = {
      pointerId: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      originX: transform.x,
      originY: transform.y,
      moved: false
    };
    return;
  }

  if (dragState?.moved) {
    suppressClick();
  }

  if (tapState && !tapState.targetIsImage && !tapState.moved) {
    suppressClick();
    closeLightbox(lightbox);
  }

  tapState = undefined;
  dragState = undefined;
  lightbox.image.classList.remove("image-lightbox-image-dragging");
}

function startTouchPinch(event: TouchEvent, lightbox: LightboxElements): void {
  const pinch = touchMetrics(event);

  if (!pinch) {
    return;
  }

  startPinchFromMetrics(lightbox, pinch);
}

function pinchImageFromMetrics(
  lightbox: LightboxElements,
  pinch: { distance: number; centerX: number; centerY: number } | undefined
): void {
  if (!pinchState || !pinch || pinchState.startDistance === 0) {
    return;
  }

  suppressClick();
  const distanceRatio = pinch.distance / pinchState.startDistance;
  const nextScale = clamp(pinchState.startScale * distanceRatio ** pinchSensitivity, minScale, maxScale);

  transform = {
    scale: nextScale,
    x: pinch.centerX - pinchState.baseCenterX - pinchState.contentX * nextScale,
    y: pinch.centerY - pinchState.baseCenterY - pinchState.contentY * nextScale
  };
  applyImageTransform(lightbox);
}

function startPinchFromMetrics(
  lightbox: LightboxElements,
  pinch: { distance: number; centerX: number; centerY: number }
): void {
  const anchor = imageAnchorAt(lightbox, pinch.centerX, pinch.centerY);

  dragState = undefined;
  pinchState = {
    startDistance: pinch.distance,
    startScale: transform.scale,
    baseCenterX: anchor.baseCenterX,
    baseCenterY: anchor.baseCenterY,
    contentX: anchor.contentX,
    contentY: anchor.contentY
  };
  lightbox.image.classList.add("image-lightbox-image-dragging");
}

function touchMetrics(event: TouchEvent): { distance: number; centerX: number; centerY: number } | undefined {
  const left = event.touches.item(0);
  const right = event.touches.item(1);

  if (!left || !right) {
    return undefined;
  }

  const dx = right.clientX - left.clientX;
  const dy = right.clientY - left.clientY;

  return {
    distance: Math.hypot(dx, dy),
    centerX: (left.clientX + right.clientX) / 2,
    centerY: (left.clientY + right.clientY) / 2
  };
}

function applyImageTransform(lightbox: LightboxElements): void {
  lightbox.image.style.transform = `translate3d(${roundTransform(transform.x)}px, ${roundTransform(transform.y)}px, 0) scale(${roundTransform(transform.scale)})`;
}

function scaleImageAt(lightbox: LightboxElements, clientX: number, clientY: number, scale: number): void {
  const nextScale = clamp(scale, minScale, maxScale);

  if (nextScale === transform.scale) {
    return;
  }

  const anchor = imageAnchorAt(lightbox, clientX, clientY);

  transform = {
    scale: nextScale,
    x: clientX - anchor.baseCenterX - anchor.contentX * nextScale,
    y: clientY - anchor.baseCenterY - anchor.contentY * nextScale
  };
  applyImageTransform(lightbox);
}

function imageAnchorAt(
  lightbox: LightboxElements,
  clientX: number,
  clientY: number
): { baseCenterX: number; baseCenterY: number; contentX: number; contentY: number } {
  const rect = lightbox.image.getBoundingClientRect();
  const visualCenterX = rect.left + rect.width / 2;
  const visualCenterY = rect.top + rect.height / 2;
  const baseCenterX = visualCenterX - transform.x;
  const baseCenterY = visualCenterY - transform.y;

  return {
    baseCenterX,
    baseCenterY,
    contentX: (clientX - baseCenterX - transform.x) / transform.scale,
    contentY: (clientY - baseCenterY - transform.y) / transform.scale
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTransform(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function suppressClick(): void {
  suppressClickUntil = Date.now() + clickSuppressMs;
}

function suppressSyntheticClick(event: MouseEvent): void {
  if (Date.now() >= suppressClickUntil) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
}

function lightboxImageClassList(): DOMTokenList | undefined {
  return boundLightbox?.image.classList;
}

function capturePointer(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic and older mobile pointer paths can reject capture while still
    // delivering usable pointer coordinates.
  }
}

function releasePointer(element: HTMLElement, pointerId: number): void {
  try {
    element.releasePointerCapture(pointerId);
  } catch {
    // Capture may already be gone after a touch gesture is cancelled.
  }
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  elementType: new (...args: never[]) => T
): T {
  const element = root.querySelector(selector);

  if (!(element instanceof elementType)) {
    throw new Error(`Missing lightbox element: ${selector}`);
  }

  return element;
}
