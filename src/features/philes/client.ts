import { initLifeArt } from "@/shared/textmode/life/client";

export function installPhileInteractions(): void {
  initLifeArt();
  if (document.querySelector("[data-lightbox-image]")) {
    void import("@/shared/textmode/lightbox").then(({ installImageLightbox }) => installImageLightbox());
  }
}
