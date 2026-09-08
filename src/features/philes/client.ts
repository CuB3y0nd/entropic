import { initLifeArt } from "@/shared/textmode/life/client";
import { installByteInspector } from "./inspection/client";

export function installPhileInteractions(): void {
  initLifeArt();
  installByteInspector();
  if (document.querySelector("[data-lightbox-image]")) {
    void import("@/shared/textmode/lightbox").then(({ installImageLightbox }) => installImageLightbox());
  }
}
