const pendingCopies = new WeakSet<HTMLButtonElement>();
const feedbackTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

// Delegation also handles controls mounted later by artwork rotation.
document.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("button[data-copy-text]") : null;
  if (!(button instanceof HTMLButtonElement) || button.dataset.copyText === undefined) return;
  // Without this script, the native popover still exposes selectable text.
  event.preventDefault();
  if (pendingCopies.has(button)) return;
  void copyText(button, button.dataset.copyText);
});

async function copyText(button: HTMLButtonElement, text: string): Promise<void> {
  pendingCopies.add(button);
  button.setAttribute("aria-busy", "true");
  const status = button.parentElement?.querySelector<HTMLElement>(".badge-copy-status");
  if (status) {
    clearTimeout(feedbackTimers.get(status));
    status.textContent = "";
  }
  try {
    await navigator.clipboard.writeText(text);
    if (status && button.isConnected) {
      status.textContent = "Copied!";
      feedbackTimers.set(
        status,
        setTimeout(() => {
          status.textContent = "";
        }, 3000)
      );
    }
  } catch {
    if (!button.isConnected) return;
    const dialog = button.popoverTargetElement;
    if (dialog instanceof HTMLElement) {
      dialog.showPopover({ source: button });
      const textField = dialog.querySelector("textarea");
      textField?.focus({ preventScroll: true });
      textField?.select();
    }
  } finally {
    pendingCopies.delete(button);
    button.removeAttribute("aria-busy");
  }
}
