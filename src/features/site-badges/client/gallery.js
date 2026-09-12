(() => {
  const browser = document.currentScript?.previousElementSibling;
  const toggle = browser?.querySelector(".badge-toggle");
  const dialog = browser?.querySelector(".badge-dialog");
  const body = dialog?.querySelector(".badge-dialog-body");
  const actions = browser?.querySelector(".badge-actions");
  if (!(toggle instanceof HTMLButtonElement) || !(dialog instanceof HTMLDialogElement) || !body || !actions) return;

  const mobile = window.matchMedia("(max-width: 760px)");
  browser.dataset.modal = "";
  toggle.hidden = false;
  toggle.addEventListener("click", () => {
    if (!mobile.matches || dialog.open) return;
    body.append(actions);
    dialog.showModal();
    toggle.setAttribute("aria-expanded", "true");
  });
  dialog.querySelector(".badge-dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    ) {
      dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    for (const popover of actions.querySelectorAll(":popover-open")) popover.hidePopover();
    // Move the original controls back so copying, focus and artwork rotation
    // never depend on a second set of buttons.
    browser.insertBefore(actions, dialog);
    toggle.setAttribute("aria-expanded", "false");
    if (mobile.matches) toggle.focus({ preventScroll: true });
  });
  mobile.addEventListener("change", () => {
    if (!mobile.matches && dialog.open) dialog.close();
  });
})();
