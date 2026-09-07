import bocchiImage from "@/assets/decorations/bocchi-the-rock/bocchi.png";
import bocchiBoxImage from "@/assets/decorations/bocchi-the-rock/bocchi-box.png";
import guitarKitImage from "@/assets/decorations/bocchi-the-rock/guitar-kit.png";
import kessokuBreakImage from "@/assets/decorations/bocchi-the-rock/kessoku-break.png";
import kitaDuetImage from "@/assets/decorations/bocchi-the-rock/kita-duet.png";
import kaedeImage from "@/assets/decorations/bunny-girl-senpai/kaede.png";
import maiReturnImage from "@/assets/decorations/bunny-girl-senpai/mai-return.png";
import pandaSlippersImage from "@/assets/decorations/bunny-girl-senpai/panda-slippers.png";
import denjiPochitaToastImage from "@/assets/decorations/chainsaw-man/denji-pochita-toast.png";
import powerAkiMeowyImage from "@/assets/decorations/chainsaw-man/power-aki-meowy.png";
import eizoukenFlightImage from "@/assets/decorations/eizouken/eizouken-flight.png";
import eizoukenFrameImage from "@/assets/decorations/eizouken/eizouken-frame.png";
import shikiLedgeImage from "@/assets/decorations/garden-of-sinners/shiki-ledge.png";
import shikiMikiyaUmbrellaImage from "@/assets/decorations/garden-of-sinners/shiki-mikiya-umbrella.png";
import haruhiPlaneImage from "@/assets/decorations/haruhi/haruhi-plane.png";
import sosBooksImage from "@/assets/decorations/haruhi/sos-books.png";
import yukiReadingImage from "@/assets/decorations/haruhi/yuki-reading.png";
import asaEmiriWalkImage from "@/assets/decorations/journal-with-witch/asa-emiri-walk.png";
import makioAsaPagesImage from "@/assets/decorations/journal-with-witch/makio-asa-pages.png";
import catsReachingImage from "@/assets/decorations/sonny-boy/cats-reaching.png";
import catsToteImage from "@/assets/decorations/sonny-boy/cats-tote.png";
import mizuhoCourierImage from "@/assets/decorations/sonny-boy/mizuho-courier.png";
import nagaraNozomiImage from "@/assets/decorations/sonny-boy/nagara-nozomi.png";
import yamabikoImage from "@/assets/decorations/sonny-boy/yamabiko.png";
import akashiMochigumanImage from "@/assets/decorations/tatami-galaxy/akashi-mochiguman.png";
import watashiOzuCycleImage from "@/assets/decorations/tatami-galaxy/watashi-ozu-cycle.png";
import type { BadgeArtwork } from "../model";
import type { BadgeArtworkPresetId } from "./catalog";

// Display dimensions and placement preserve the approved compositions.
export const badgeArtworkPresets = {
  catsTote: {
    source: catsToteImage,
    displayWidthPx: 184,
    displayHeightPx: 140,
    placement: "top-left",
    badgeOverlapPx: 20,
    companion: {
      source: catsReachingImage,
      displayWidthPx: 96,
      displayHeightPx: 63,
      placement: "bottom-right"
    }
  },
  mizuhoCourier: {
    source: mizuhoCourierImage,
    displayWidthPx: 145,
    displayHeightPx: 148,
    placement: "top-right",
    badgeOverlapPx: 20
  },
  yamabiko: {
    source: yamabikoImage,
    displayWidthPx: 192,
    displayHeightPx: 80
  },
  bocchiPortrait: {
    source: bocchiImage,
    displayWidthPx: 176,
    displayHeightPx: 89
  },
  nagaraNozomi: {
    source: nagaraNozomiImage,
    displayWidthPx: 240,
    displayHeightPx: 160,
    badgeOverlapPx: 30
  },
  bocchiBox: {
    source: bocchiBoxImage,
    displayWidthPx: 144,
    displayHeightPx: 120,
    placement: "top-right"
  },
  kessokuBreak: {
    source: kessokuBreakImage,
    displayWidthPx: 296,
    displayHeightPx: 118
  },
  kaedePortrait: {
    source: kaedeImage,
    displayWidthPx: 180,
    displayHeightPx: 104
  },
  kitaDuet: {
    source: kitaDuetImage,
    displayWidthPx: 188,
    displayHeightPx: 168,
    placement: "bottom-right"
  },
  haruhiPlane: {
    source: haruhiPlaneImage,
    displayWidthPx: 97,
    displayHeightPx: 110,
    placement: "top-right"
  },
  yukiReading: {
    source: yukiReadingImage,
    displayWidthPx: 74,
    displayHeightPx: 111,
    placement: "left"
  },
  maiReturn: {
    source: maiReturnImage,
    displayWidthPx: 186,
    displayHeightPx: 156,
    placement: "bottom-right"
  },
  guitarKit: {
    source: guitarKitImage,
    displayWidthPx: 64,
    displayHeightPx: 87,
    placement: "bottom-left"
  },
  sosBooks: {
    source: sosBooksImage,
    displayWidthPx: 124,
    displayHeightPx: 66,
    placement: "bottom-right"
  },
  pandaSlippers: {
    source: pandaSlippersImage,
    displayWidthPx: 108,
    displayHeightPx: 61,
    placement: "bottom-right"
  },
  shikiLedge: {
    source: shikiLedgeImage,
    displayWidthPx: 161,
    displayHeightPx: 164,
    placement: "top-right",
    badgeOverlapPx: 16
  },
  shikiMikiyaUmbrella: {
    source: shikiMikiyaUmbrellaImage,
    displayWidthPx: 210,
    displayHeightPx: 166,
    placement: "bottom-right"
  },
  denjiPochitaToast: {
    source: denjiPochitaToastImage,
    displayWidthPx: 229,
    displayHeightPx: 156,
    placement: "top-left",
    badgeOverlapPx: 14
  },
  powerAkiMeowy: {
    source: powerAkiMeowyImage,
    displayWidthPx: 153,
    displayHeightPx: 170,
    placement: "bottom-right"
  },
  makioAsaPages: {
    source: makioAsaPagesImage,
    displayWidthPx: 194,
    displayHeightPx: 158,
    placement: "bottom-right"
  },
  asaEmiriWalk: {
    source: asaEmiriWalkImage,
    displayWidthPx: 182,
    displayHeightPx: 170,
    placement: "top-left",
    badgeOverlapPx: 12
  },
  eizoukenFlight: {
    source: eizoukenFlightImage,
    displayWidthPx: 237,
    displayHeightPx: 160,
    placement: "top-left",
    badgeOverlapPx: 16
  },
  eizoukenFrame: {
    source: eizoukenFrameImage,
    displayWidthPx: 258,
    displayHeightPx: 152,
    placement: "bottom-right"
  },
  watashiOzuCycle: {
    source: watashiOzuCycleImage,
    displayWidthPx: 237,
    displayHeightPx: 160,
    placement: "bottom-left"
  },
  akashiMochiguman: {
    source: akashiMochigumanImage,
    displayWidthPx: 121,
    displayHeightPx: 166,
    placement: "top-right",
    badgeOverlapPx: 18
  }
} as const satisfies Record<BadgeArtworkPresetId, BadgeArtwork>;
