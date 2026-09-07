/**
 * Entropic site configuration. Make site-specific changes here; keep the type
 * import and `satisfies EntropicConfig` for editor completion and configuration
 * checks.
 *
 * Optional fields inherit defaults when omitted or set to undefined (without
 * quotes). For example, home.asciiArt: undefined uses the built-in banner;
 * replace undefined with a backtick string to supply your own multiline
 * artwork.
 *
 * Theme defaults (ASCII banner, colors, fonts, sizes, effects, and text grid)
 * live in src/config/defaults.ts. General feature and volume defaults are
 * applied in src/config/resolve.ts; option-specific defaults are described
 * beside the fields. Customize values here instead of copying defaults or
 * editing those internal files.
 *
 * Appearance, textmode, effects, and particle page overrides merge by field,
 * ignoring undefined values. Arrays replace the entire list; numeric ranges
 * need both endpoints. false, 0, "", and [] keep their documented meanings and
 * do not select defaults. For example, itemPrefix: "" hides the prefix, while
 * asciiArt: "" is invalid. Use null only where explicitly supported, such as
 * buttons.artwork.fallback: null. Required fields still need values, including
 * site identity, the selected artwork mode's required parameters, and the
 * email/key settings when WKD is enabled.
 *
 * Use pnpm dev to preview edits; configuration changes may restart the dev
 * server. Production values are captured by pnpm build and require a rebuild to
 * change. pnpm check:config validates values; pnpm check also checks types and
 * formatting.
 */
import type { EntropicConfig } from "./src/config/types";

export default {
  // Site identity. url is an HTTP(S) origin without a subpath, query, or
  // fragment; canonical links, Open Graph, RSS, and sitemap addresses use it.
  site: {
    url: "https://www.cubeyond.net/",
    name: "Entropic",
    description: "Security research, reverse engineering, exploitation notes, and CTF write-ups.",
    // Sharing image: src is a path from public/ (starting with /), or an
    // absolute HTTP(S) URL. width and height are the image dimensions in px.
    // alt conveys the image's meaningful text/content for accessibility.
    // type is the actual image MIME type; omit it if unknown.
    socialImage: {
      src: "/assets/social/entropic-og.jpg",
      alt: "Entropic — Research Philes: vulnerability research, reverse engineering, and exploitation notes.",
      type: "image/jpeg",
      width: 1200,
      height: 630
    }
  },
  home: {
    // Single-line text; sections/items can override prefix individually. ""
    // omits it.
    sectionPrefix: undefined,
    itemPrefix: undefined,
    // Home banner: undefined keeps the built-in Entropic art. Use a backtick
    // string for custom multiline art.
    asciiArt: undefined,
    sections: [
      {
        title: "TL;DR",
        items: [
          {
            label: "Cybersecurity enthusiast. Idealist. Purist."
          },
          {
            label: "Offensive Researcher @RaptX",
            // Link only this part of label; omit to link the whole text.
            linkLabel: "@RaptX",
            href: "https://raptx.org/",
            external: true
          },
          {
            label: "Vulnerability disclosures",
            href: "/cves/"
          }
        ]
      },
      {
        title: "Philes",
        // include/exclude: volume number arrays; sort: "asc"/"desc".
        volumes: {
          sort: "asc",
          showEmpty: false
        }
      },
      {
        title: "Fields",
        items: [
          {
            label: "Binary Exploitation"
          },
          {
            label: "Windows Security"
          },
          {
            label: "IoT Security"
          },
          {
            label: "Automation"
          }
        ]
      }
    ]
  },
  // 88x31 buttons. Each item has label, imageSrc, and exactly one action:
  // href: an HTTP(S), mailto:, or local URL; copyText: the text to copy when
  // clicked.
  // imageSrc: /assets/88x31/name.gif maps to public/assets/88x31/name.gif;
  // HTTP(S) image URLs also work.
  buttons: {
    // Shuffle once per production build (including Vercel); the order stays
    // fixed until the next build.
    // Defaults to true. Set false to use items order; local development always
    // uses items order.
    shuffleOnBuild: true,
    items: [
      {
        label: "cubeyond.net",
        href: "https://cubeyond.net/",
        imageSrc: "/assets/88x31/button.gif"
      },
      {
        label: "nikolan",
        href: "https://nikolan.xyz/",
        imageSrc: "https://nikolan.net/resources/88x31s/button.png"
      },
      {
        label: "GitHub",
        href: "https://github.com/CuB3y0nd",
        imageSrc: "/assets/88x31/github.png"
      },
      {
        label: "E-mail",
        href: "mailto:root@cubeyond.net",
        imageSrc: "/assets/88x31/email.gif"
      },
      {
        label: "MyAnimeList",
        href: "https://myanimelist.net/animelist/CuB3y0nd",
        imageSrc: "/assets/88x31/myanimelist.png"
      },
      {
        label: "Discord",
        copyText: "CuB3y0nd#6307",
        imageSrc: "/assets/88x31/discord.gif"
      },
      {
        label: "IDA",
        href: "https://auth.lol/",
        imageSrc: "/assets/88x31/ida.png"
      },
      {
        label: "Steam",
        href: "https://steamcommunity.com/id/CuB3y0nd/",
        imageSrc: "/assets/88x31/steam.gif"
      },
      {
        label: "Minecraft",
        href: "https://namemc.com/profile/EFLAGS.1",
        imageSrc: "/assets/88x31/minecraft.png"
      },
      {
        label: "PGP public key",
        href: "/assets/pgp/public-key.asc",
        imageSrc: "/assets/88x31/pgp.gif"
      },
      {
        label: "Gentoo",
        href: "https://www.gentoo.org/",
        imageSrc: "/assets/88x31/gentoo.gif"
      },
      {
        label: "Neovim",
        href: "https://neovim.io/",
        imageSrc: "/assets/88x31/neovim.gif"
      },
      {
        label: "Portal",
        href: "https://www.thinkwithportals.com/",
        imageSrc: "/assets/88x31/portal.png"
      },
      {
        label: "Rust",
        href: "https://rust-lang.org/",
        imageSrc: "/assets/88x31/rust.gif"
      },
      {
        label: "Memos",
        href: "https://memos.cubeyond.net/",
        imageSrc: "/assets/88x31/memos.gif"
      },
      {
        label: "Ko-fi",
        href: "https://ko-fi.com/cub3y0nd",
        imageSrc: "/assets/88x31/ko-fi.png"
      },
      {
        label: "RSS",
        href: "https://www.cubeyond.net/rss.xml",
        imageSrc: "/assets/88x31/rss.png"
      }
    ],
    // Set buttons.artwork to false or use one of these selection objects:
    // { mode: "fixed", preset: "nagaraNozomi" } always displays that preset.
    // { mode: "daily", timeZone: "Asia/Shanghai" } chooses once per calendar
    // day in that time zone.
    // { mode: "interval", hours: 6 } chooses every 6 hours on UTC boundaries;
    // hours is an integer, 1..8760.
    // { mode: "visit" } chooses on each page load; consecutive choices may
    // repeat.
    // { mode: "custom", artwork: {
    //   source: "/assets/my-art.png", displayWidthPx: 240,
    //   displayHeightPx: 160, placement: "top-right", badgeOverlapPx: 20
    // } } displays your own image.
    // In custom mode, the image settings live in buttons.artwork.artwork:
    // source: /assets/my-art.png maps to public/assets/my-art.png; HTTP(S)
    // image URLs also work.
    // displayWidthPx/displayHeightPx set the rendered size in CSS pixels.
    // placement accepts "top", "top-left", "top-right", "bottom",
    // "bottom-left", "bottom-right", "left", "right".
    // badgeOverlapPx controls overlap with the badge panel, in CSS pixels.
    // Optional companion is a second image object with source, displayWidthPx,
    // displayHeightPx, and placement: "bottom-left" or "bottom-right".
    // With mode: "daily", "interval", or "visit", add buttons.artwork.presets
    // to limit the pool, e.g. presets: ["catsTote", "nagaraNozomi"]. Use unique
    // preset IDs; omit the field for all presets.
    // An empty presets array is invalid.
    artwork: {
      mode: "daily",
      // For mode: "daily" (required). IANA time zone defining the day boundary,
      // e.g. "UTC".
      timeZone: "Asia/Shanghai",
      // For mode: "daily" or "interval". A non-empty string; changing it
      // produces a different schedule.
      seed: "entropic-artwork-v1",
      // For mode: "daily", "interval", or "visit". Preset shown without
      // JavaScript; null omits that image.
      fallback: "nagaraNozomi"
    }
  },
  theme: {
    // theme.appearance groups are colors, fonts, and sizing; supply only the
    // fields you want to override.
    // Optional theme.appearance.fonts example:
    // { asciiFamily: "MyMono", asciiUrl: "/assets/fonts/my-mono.woff2",
    //   asciiFormat: "woff2" }.
    // asciiFamily names the font; asciiUrl points to its file; asciiFormat
    // matches that file's format.
    // Optional theme.appearance.sizing example:
    // { textSize: "14px", textCell: "8px", homeSize: "14px" }.
    // textSize is the ASCII text size; textCell is one character's width;
    // homeSize is the homepage text size.
    // sizing also accepts cjkSize and cjkLinkSize for ordinary and linked CJK
    // glyphs. All sizes are CSS lengths.
    appearance: {
      // theme.appearance.colors values are CSS color strings, e.g. "#93ffd7",
      // "rgb(147 255 215)", "transparent".
      // background applies to inner pages; homeBackground applies to the
      // homepage.
      // Optional particle colors in this same object:
      // particleHome/particleHomeGlow (homepage),
      // particleVolume/particleVolumeGlow (volume pages),
      // particlePage/particlePageGlow (articles).
      colors: {
        background: undefined,
        homeBackground: undefined,
        foreground: undefined,
        link: undefined,
        linkHover: undefined,
        linkHoverBackground: undefined
      }
    },
    // Optional theme.textmode is a sibling of appearance and effects:
    // { columns: 90, bodyWidth: 80 }.
    // Its fields count character cells: columns (full text grid),
    // bodyWidth (article line width), textIndent (article indentation),
    // articleArtIndent/volumeArtIndent (ASCII artwork start columns), and
    // volumeRightColumn (right-hand alignment column on volume pages).
    // theme.textmode.mobileFitBreakpoint is the maximum viewport width for
    // mobile text fitting, in CSS pixels.
    effects: {
      // theme.effects.particles controls floating background symbols: undefined
      // (defaults), false, or an overrides object.
      // Example particles object:
      // { pages: { home: { desktopCount: 60, mobileCount: 20 } } }.
      // Under particles.pages, "home", "volume", and "article" each accept:
      // desktopCount/mobileCount: particle counts (integers, 0..1000;
      // lower-power devices may use fewer).
      // opacity: random [minimum, maximum] base opacity, e.g. [0.2, 0.5],
      // within 0..1.
      // pointerScale: mouse/touch interaction strength (0..100; 1 is normal, 0
      // removes pointer influence).
      // The following fields go directly in theme.effects.particles, outside
      // pages:
      // chars: symbols to sample, e.g. [".", "*", ":"]; a non-empty array of
      // non-whitespace strings.
      // mobileBreakpoint: viewport cutoff for mobile settings (CSS px); coarse
      // pointers also use those settings.
      // contentSafeWidth: central area avoided when spawning particles on wide
      // volume/article pages (CSS px).
      // pointerInfluenceRadius: radius around the mouse/touch point that
      // affects particles (CSS px).
      // driftX/driftY: random [minimum, maximum] movement in CSS px per motion
      // step; positive means right/down.
      // phaseStep: random [minimum, maximum] brightness-flicker phase advance,
      // in radians per motion step.
      // Example ranges: driftX: [-0.28, 0.28], driftY: [-0.72, -0.2],
      // phaseStep: [0.03, 0.085].
      particles: undefined,
      // theme.effects.homeAsciiGlitch distorts the homepage ASCII banner.
      // Set homeAsciiGlitch to undefined (defaults), false, or an object such
      // as { minIntervalMs: 2000, maxIntervalMs: 8000 }.
      // Fields inside homeAsciiGlitch:
      // minIntervalMs/maxIntervalMs: shortest/longest pause between bursts, in
      // milliseconds (at least 1).
      // frameMinMs/frameMaxMs: shortest/longest duration of each active glitch
      // frame, in milliseconds (at least 1).
      // burstFrameMin/burstFrameMax: number of active frames per burst
      // (integers, 1..1000).
      // mutationRatioMin/mutationRatioMax: character-mutation intensity (0..1);
      // larger values change more characters.
      // lineShiftChance: base chance of horizontal line distortion (0..1).
      homeAsciiGlitch: undefined
    }
  },
  // Vercel Web Analytics.
  analytics: true,
  // Web Key Directory: public key discovery by email address.
  wkd: {
    enabled: true,
    // Must match an email UID in the public key; its domain sets the WKD URL.
    email: "root@cubeyond.net",
    // Repository-relative PUBLIC key export (not a private key). Changes
    // require a rebuild.
    publicKeyPath: "public/assets/pgp/public-key.asc"
  },
  // Keys match src/content/philes/volume-<n>/; override only needed fields.
  // Optional: subtitle, listLabel, entryPrefix, entryLabel ("index"/"year"),
  // reverseEntryNumbers.
  // phileSort.by: "date"/"order"; direction: "asc"/"desc". postscript: text
  // lines, or [] to hide it.
  volumes: {
    "0": {
      title: "Security Research",
      listLabel: "Volume 0 - Security Research",
      phileSort: {
        by: "order",
        direction: "asc"
      },
      postscript: [
        "  ──[ 0x51 ]─────────────────────────────────────────────────────────────────//───",
        "",
        "  What is this unseen flame of darkness whose sparks are the stars?",
        "",
        "  Tagore, Stray Birds"
      ]
    },
    "1": {
      title: "Historical Philes",
      listLabel: "Volume 1 - Historical Philes",
      postscript: [
        "  ──[ EOF ]──────────────────────────────────────────────────────────────────//───",
        "",
        "  Life can only be understood backwards;",
        "  but it must be lived forwards.",
        "",
        "  Søren Kierkegaard"
      ],
      phileSort: {
        by: "date",
        direction: "desc"
      },
      entryPrefix: "A"
    },
    "2": {
      title: "Year-End Wrap-ups",
      listLabel: "Volume 2 - Year-End Wrap-ups",
      postscript: [
        "  ──[ 0x146 ]────────────────────────────────────────────────────────────────//───",
        "",
        "  Let this be my last word,",
        "  that I trust in thy love.",
        "",
        "  Tagore, Stray Birds"
      ],
      phileSort: {
        by: "date",
        direction: "desc"
      },
      entryLabel: "year"
    },
    "3": {
      title: "Chromatic Philes",
      listLabel: "Volume 3 - Chromatic Philes",
      postscript: [
        "  ──[ SGR ]──────────────────────────────────────────────────────────────────//───",
        "",
        "  Color is only another byte of pressure",
        "  applied to a line that was already executable.",
        "",
        "  Entropic notes"
      ],
      phileSort: {
        by: "date",
        direction: "desc"
      },
      entryPrefix: "C"
    }
  },
  cves: {
    enabled: true,
    // id: unique CVE-YYYY-NNNN; title: description; date: a real YYYY-MM-DD
    // calendar date.
    records: [
      {
        id: "CVE-2024-25817",
        title: "eza Heap Buffer Overflow via .git Metadata",
        date: "2024-03-05"
      },
      {
        id: "CVE-2025-60939",
        title: "Spotify Client Denial of Service",
        date: "2025-10-23"
      },
      {
        id: "CVE-2026-56113",
        title: "dhcpcd Heap Use-After-Free in dhcp6_deprecateaddrs via DHCPv6 RENEW",
        date: "2026-06-23"
      },
      {
        id: "CVE-2026-56114",
        title: "dhcpcd Stack Out-of-Bounds Write in dhcp6_makemessage()",
        date: "2026-06-23"
      },
      {
        id: "CVE-2026-56116",
        title: "dhcpcd Memory Leak DoS via IPv6 Router Advertisement Handling",
        date: "2026-06-23"
      },
      {
        id: "CVE-2026-56117",
        title: "dhcpcd Heap Use-After-Free via Control Socket Handling",
        date: "2026-06-23"
      },
      {
        id: "CVE-2026-58458",
        title: "Don't Starve Together Public Lobby world_gen_data Client DoS",
        date: "2026-06-27"
      },
      {
        id: "CVE-2026-58459",
        title: "GPSd gpsprof gnuplot Command Injection via GPS Metadata",
        date: "2026-06-27"
      },
      {
        id: "CVE-2026-61702",
        title: "cups Root-side Banner File Disclosure",
        date: "2026-06-27"
      },
      {
        id: "CVE-2026-60122",
        title: "GPSd gpsprof Code Injection via SKY.satellites used Field",
        date: "2026-07-23"
      },
      {
        id: "CVE-2026-65601",
        title: "Traefik before 3.7.7 Namespace Confusion via HTTPRoute ExtensionRef",
        date: "2026-07-22"
      },
      {
        id: "CVE-2026-65602",
        title: "Traefik before 3.6.23 IngressRouteTCP ServersTransport Namespace Bypass",
        date: "2026-07-22"
      },
      {
        id: "CVE-2026-77395",
        title: "stargz remote snapshots RCE via image cache poisoning",
        date: "2026-06-27"
      }
    ]
  }
} as const satisfies EntropicConfig;
