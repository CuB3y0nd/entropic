import { initLifeArt } from "@/shared/textmode/life/client";
import { installSelectionTools } from "./selection/client";

export function installPhileInteractions(): void {
  initLifeArt();
  installSelectionTools();
  if (document.querySelector("[data-lightbox-image]")) {
    void import("@/shared/textmode/lightbox").then(({ installImageLightbox }) => installImageLightbox());
  }
}
