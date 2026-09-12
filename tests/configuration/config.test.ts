import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultAppearance, defaultEffects } from "../../src/config/defaults";
import { resolveConfig, resolveVolumeConfig } from "../../src/config/resolve";
import type { CveCircuitConfig, EntropicConfig } from "../../src/config/types";
import { sitemapEntries } from "../../src/features/seo/xml";

const site = { url: "https://example.org/", name: "My Philes", description: "A personal textmode site" };

test("sharing images accept public paths and absolute HTTP(S) URLs, including query strings", () => {
  for (const src of ["/assets/og.jpg", "https://cdn.example.org/og?id=123", "http://cdn.example.org/og.jpg"]) {
    assert.doesNotThrow(() =>
      resolveConfig({ site: { ...site, socialImage: { src, alt: "My Philes", width: 1200, height: 630 } } })
    );
  }
});

test("sharing image validation rejects ambiguous URLs and invalid metadata at the responsible field", () => {
  const socialImage = { src: "/assets/og.jpg", alt: "My Philes", type: "image/jpeg", width: 1200, height: 630 };
  const cases: readonly [Partial<typeof socialImage>, RegExp][] = [
    [{ src: "assets/og.jpg" }, /site.socialImage.src/],
    [{ src: "//cdn.example.org/og.jpg" }, /site.socialImage.src/],
    [{ src: " https://cdn.example.org/og.jpg" }, /site.socialImage.src/],
    [{ src: "https://user:password@cdn.example.org/og.jpg" }, /site.socialImage.src/],
    [{ src: "/assets/og.jpg#preview" }, /site.socialImage.src/],
    [{ src: "javascript:alert(1)" }, /site.socialImage.src/],
    [{ alt: " " }, /site.socialImage.alt/],
    [{ type: "text/html" }, /site.socialImage.type/],
    [{ width: 0 }, /site.socialImage.width/],
    [{ height: 630.5 }, /site.socialImage.height/]
  ];
  for (const [override, field] of cases) {
    assert.throws(() => resolveConfig({ site: { ...site, socialImage: { ...socialImage, ...override } } }), field);
  }
});

test("an explicit ASCII banner is used verbatim, including leading spaces and empty lines", () => {
  const asciiArt = "  ENTROPIC\n\n    /_\\";
  assert.equal(resolveConfig({ site, home: { asciiArt } }).home.asciiArt, asciiArt);
});

test("CVE circuit settings inherit independently and can disable motion without disabling the page", () => {
  const defaultsBefore = { ...defaultEffects.cveCircuit };
  const resolveCircuit = (cveCircuit?: false | Partial<Omit<CveCircuitConfig, "enabled">>) =>
    resolveConfig({ site, cves: { enabled: true }, theme: { effects: { cveCircuit } } });
  assert.deepEqual(resolveCircuit().theme.effects.cveCircuit, { enabled: true, cycleMs: 14000, signalSize: 3 });
  assert.deepEqual(resolveCircuit({ signalSize: 5 }).theme.effects.cveCircuit, {
    enabled: true,
    cycleMs: 14000,
    signalSize: 5
  });
  assert.deepEqual(resolveCircuit({ cycleMs: 24000, signalSize: undefined }).theme.effects.cveCircuit, {
    enabled: true,
    cycleMs: 24000,
    signalSize: 3
  });
  const disabled = resolveCircuit(false);
  assert.equal(disabled.cves.enabled, true);
  assert.deepEqual(disabled.theme.effects.cveCircuit, { enabled: false, cycleMs: 14000, signalSize: 3 });
  assert.deepEqual(defaultEffects.cveCircuit, defaultsBefore);
});

test("undefined optional settings inherit defaults, including nested theme fields", () => {
  const config = resolveConfig({
    site,
    home: { asciiArt: undefined, sectionPrefix: undefined, itemPrefix: undefined },
    philes: { inspect: undefined, fragmentLinks: undefined },
    theme: {
      appearance: {
        colors: { background: undefined, link: undefined },
        fonts: { asciiFamily: undefined, asciiUrl: undefined },
        sizing: { homeSize: undefined }
      },
      textmode: { bodyWidth: undefined },
      effects: {
        particles: {
          chars: undefined,
          driftX: undefined,
          pages: { home: { opacity: undefined }, volume: undefined, article: { mobileCount: undefined } }
        },
        homeAsciiGlitch: { minIntervalMs: undefined },
        cveCircuit: { cycleMs: undefined, signalSize: undefined }
      }
    }
  });
  assert.deepEqual(config, resolveConfig({ site }));
});

test("undefined leaves inherit defaults alongside explicit empty, zero, and false overrides", () => {
  const config = resolveConfig({
    site,
    home: { sectionPrefix: "", itemPrefix: "", asciiArt: undefined, sections: [] },
    buttons: { items: [], artwork: false, shuffleOnBuild: false },
    theme: {
      appearance: { colors: { link: "#ff00ff", background: undefined } },
      effects: {
        particles: { chars: ["*"], driftX: undefined, pages: { home: { mobileCount: 0, desktopCount: undefined } } },
        homeAsciiGlitch: false
      }
    }
  });
  assert.equal(config.home.sectionPrefix, "");
  assert.equal(config.home.itemPrefix, "");
  assert.deepEqual(config.home.sections, []);
  assert.equal(config.buttons.artwork, false);
  assert.equal(config.buttons.shuffleOnBuild, false);
  assert.equal(config.theme.appearance.colors.link, "#ff00ff");
  assert.equal(config.theme.appearance.colors.background, defaultAppearance.colors.background);
  assert.deepEqual(config.theme.effects.particles.chars, ["*"]);
  assert.deepEqual(config.theme.effects.particles.driftX, defaultEffects.particles.driftX);
  assert.equal(config.theme.effects.particles.pages.home.mobileCount, 0);
  assert.equal(
    config.theme.effects.particles.pages.home.desktopCount,
    defaultEffects.particles.pages.home.desktopCount
  );
  assert.equal(config.theme.effects.homeAsciiGlitch.enabled, false);
});

test("empty home prefixes are not replaced by defaults", () => {
  const home = {
    sectionPrefix: "",
    itemPrefix: "",
    sections: [{ title: "Notes", prefix: "#", items: [{ label: "One", prefix: ">" }] }]
  } as const;
  const config = resolveConfig({ site, home });
  assert.equal(config.home.sectionPrefix, "");
  assert.equal(config.home.itemPrefix, "");
  assert.deepEqual(config.home.sections, home.sections);
});

test("disabling CVEs removes internal home links and empty sections while preserving records and external links", () => {
  const input = {
    site,
    home: {
      sections: [
        { title: "Only CVEs", items: [{ label: "My CVEs", href: "/cves/" }] },
        {
          title: "Mixed",
          items: [
            { label: "Also CVEs", href: "/cves?view=all#latest" },
            { label: "Absolute link", href: "https://example.org/cves/" },
            { label: "Other person's CVEs", href: "https://other.example/cves/" },
            { label: "About", href: "/about/" }
          ]
        }
      ]
    },
    cves: { enabled: false, records: [{ id: "CVE-2026-1234", title: "Research" }] }
  } as const satisfies EntropicConfig;
  const disabled = resolveConfig(input);
  assert.deepEqual(disabled.cves.records, input.cves.records);
  assert.deepEqual(
    disabled.home.sections.map(({ title }) => title),
    ["Mixed"]
  );
  assert.deepEqual(
    disabled.home.sections[0]?.items?.map(({ label }) => label),
    ["Other person's CVEs", "About"]
  );
  const enabled = resolveConfig({ ...input, cves: { ...input.cves, enabled: true } });
  assert.deepEqual(enabled.home.sections, input.home.sections);
  assert.deepEqual(
    sitemapEntries([], []).map(({ href }) => href),
    ["/", "/rss.xml"]
  );
  assert.deepEqual(
    sitemapEntries([], [], ["/cves/"]).map(({ href }) => href),
    ["/", "/cves/", "/rss.xml"]
  );
});

test("WKD can be disabled without deleting its email or public key path", () => {
  const wkd = { enabled: false, email: "root@example.org", publicKeyPath: "public/key.asc" } as const;
  assert.deepEqual(resolveConfig({ site, wkd }).wkd, wkd);
});

test("article tools default to enabled and can be disabled independently", () => {
  assert.deepEqual(resolveConfig({ site }).philes, { inspect: true, fragmentLinks: true });
  assert.deepEqual(resolveConfig({ site, philes: { inspect: false } }).philes, { inspect: false, fragmentLinks: true });
  assert.deepEqual(resolveConfig({ site, philes: { fragmentLinks: false } }).philes, {
    inspect: true,
    fragmentLinks: false
  });
  // @ts-expect-error Check the runtime boundary for JavaScript configuration too.
  assert.throws(() => resolveConfig({ site, philes: { inspect: "false" } }), /philes.inspect/);
  // @ts-expect-error Check the runtime boundary for JavaScript configuration too.
  assert.throws(() => resolveConfig({ site, philes: { fragmentLinks: "false" } }), /philes.fragmentLinks/);
});

test("a minimal configuration creates a new site without inheriting the theme author's links or records", () => {
  const config = resolveConfig({ site });
  assert.deepEqual(config.site, site);
  assert.deepEqual(config.home.sections, []);
  assert.deepEqual(config.buttons, { shuffleOnBuild: true, items: [], artwork: false });
  assert.deepEqual(config.cves, { enabled: false, records: [], recognitions: [], recognitionPeriodGapLines: 0.5 });
  assert.deepEqual(config.volumes, {});
  assert.deepEqual(config.wkd, { enabled: false });
  assert.equal(config.analytics, false);
});

test("leaf overrides preserve sibling defaults while replacing arrays and respecting explicit zero counts", () => {
  const defaultsBefore = JSON.stringify(defaultEffects);
  const config = resolveConfig({
    site,
    theme: {
      appearance: { colors: { link: "#ff00ff" } },
      effects: {
        homeAsciiGlitch: false,
        particles: { chars: ["*"], pages: { home: { mobileCount: 0, opacity: [0.1, 0.2] } } }
      }
    }
  });
  assert.equal(config.theme.appearance.colors.link, "#ff00ff");
  assert.equal(config.theme.appearance.colors.foreground, defaultAppearance.colors.foreground);
  assert.equal(config.theme.effects.homeAsciiGlitch.enabled, false);
  assert.deepEqual(config.theme.effects.particles.chars, ["*"]);
  assert.equal(config.theme.effects.particles.pages.home.mobileCount, 0);
  assert.deepEqual(config.theme.effects.particles.pages.home.opacity, [0.1, 0.2]);
  assert.equal(
    config.theme.effects.particles.pages.home.desktopCount,
    defaultEffects.particles.pages.home.desktopCount
  );
  assert.deepEqual(config.theme.effects.particles.pages.article, defaultEffects.particles.pages.article);
  assert.equal(JSON.stringify(defaultEffects), defaultsBefore);
  assert.equal(resolveConfig({ site }).theme.effects.homeAsciiGlitch.enabled, true);
});

test("new volumes use this site's name and partial volume metadata inherits a complete default", () => {
  assert.equal(resolveVolumeConfig(4, site.name).title, "My Philes Volume 4");
  const volume = resolveVolumeConfig(4, site.name, { title: "Notes", postscript: [] });
  assert.equal(volume.title, "Notes");
  assert.equal(volume.listLabel, "Volume 4");
  assert.deepEqual(volume.phileSort, { by: "date", direction: "desc" });
  assert.deepEqual(volume.postscript, []);
});

test("undefined volume fields inherit defaults without losing optional metadata or empty lists", () => {
  const overrides = { title: undefined, listLabel: undefined, phileSort: undefined, postscript: undefined };
  assert.deepEqual(resolveVolumeConfig(4, site.name, overrides), resolveVolumeConfig(4, site.name));
  assert.deepEqual(resolveVolumeConfig(4, site.name, { ...overrides, subtitle: "Notes", postscript: [] }), {
    ...resolveVolumeConfig(4, site.name),
    subtitle: "Notes",
    postscript: []
  });
});

test("daily selection supports a smaller pool and an explicit no-art fallback", () => {
  const artwork = {
    mode: "daily",
    timeZone: "Asia/Shanghai",
    presets: ["nagaraNozomi", "catsTote"],
    fallback: null
  } as const;
  assert.deepEqual(resolveConfig({ site, buttons: { items: [], artwork } }).buttons.artwork, artwork);
});

test("an explicitly undefined rotation seed uses the default for validation", () => {
  assert.doesNotThrow(() =>
    resolveConfig({
      site,
      buttons: {
        items: [],
        artwork: { mode: "daily", timeZone: "UTC", seed: undefined, fallback: null }
      }
    })
  );
});

test("button links and clipboard actions retain their configured order and exact text", () => {
  const items = [
    { label: "Email", imageSrc: "/email.gif", href: "mailto:hello@example.org" },
    { label: "Copy", imageSrc: "/copy.gif", copyText: "  <hello> & goodbye\nsecond line  " }
  ] as const;
  assert.deepEqual(resolveConfig({ site, buttons: { items } }).buttons.items, items);
});

test("button shuffling defaults to enabled and respects an explicit opt-out", () => {
  assert.equal(resolveConfig({ site, buttons: { items: [] } }).buttons.shuffleOnBuild, true);
  assert.equal(resolveConfig({ site, buttons: { items: [], shuffleOnBuild: false } }).buttons.shuffleOnBuild, false);
});

test("a button cannot combine navigation with copying or omit its action", () => {
  const badge = { label: "Example", imageSrc: "/button.gif" };
  // @ts-expect-error A button requires exactly one action; also verify the runtime boundary.
  const noAction: EntropicConfig = { site, buttons: { items: [badge] } };
  // @ts-expect-error href and copyText are mutually exclusive, including for JavaScript consumers.
  const bothActions: EntropicConfig = { site, buttons: { items: [{ ...badge, href: "/", copyText: "hello" }] } };
  for (const input of [noAction, bothActions]) {
    assert.throws(() => resolveConfig(input), /buttons.items\[0\].*exactly one action/);
  }
});

test("invalid configuration reports the editable root file and the responsible field", () => {
  const cases: readonly [Partial<EntropicConfig>, RegExp][] = [
    [{ site: { ...site, url: "javascript:alert(1)" } }, /site.url/],
    [{ site: { ...site, url: "https://example.org/blog/" } }, /site.url/],
    [{ home: { sectionPrefix: "~\n" } }, /home.sectionPrefix/],
    [{ home: { itemPrefix: "\t" } }, /home.itemPrefix/],
    [{ home: { sections: [{ title: "Notes", prefix: "\u2028" }] } }, /home.sections\[0\].prefix/],
    [
      { home: { sections: [{ title: "Notes", items: [{ label: "One", prefix: "\u001b" }] }] } },
      /home.sections\[0\].items\[0\].prefix/
    ],
    [
      { theme: { effects: { particles: { pages: { home: { mobileCount: -1 } } } } } },
      /theme.effects.particles.pages.home.mobileCount/
    ],
    [{ theme: { effects: { particles: { driftX: [1, -1] } } } }, /theme.effects.particles.driftX/],
    [{ theme: { effects: { cveCircuit: { cycleMs: 0 } } } }, /theme.effects.cveCircuit.cycleMs/],
    [{ theme: { effects: { cveCircuit: { cycleMs: 120001 } } } }, /theme.effects.cveCircuit.cycleMs/],
    [{ theme: { effects: { cveCircuit: { cycleMs: Number.NaN } } } }, /theme.effects.cveCircuit.cycleMs/],
    [{ theme: { effects: { cveCircuit: { signalSize: 0 } } } }, /theme.effects.cveCircuit.signalSize/],
    [{ theme: { effects: { cveCircuit: { signalSize: 1.5 } } } }, /theme.effects.cveCircuit.signalSize/],
    [{ theme: { effects: { cveCircuit: { signalSize: 7 } } } }, /theme.effects.cveCircuit.signalSize/],
    [
      { theme: { effects: { homeAsciiGlitch: { mutationRatioMax: 2 } } } },
      /theme.effects.homeAsciiGlitch.mutationRatio/
    ],
    [{ theme: { textmode: { bodyWidth: 100 } } }, /theme.textmode.bodyWidth/],
    [{ theme: { appearance: { colors: { background: "red;}</style>" } } } }, /theme.appearance/],
    [{ buttons: { items: [], artwork: { mode: "daily", timeZone: "Not/AZone" } } }, /buttons.artwork/],
    [{ buttons: { items: [], artwork: { mode: "daily", timeZone: "UTC", presets: [] } } }, /buttons.artwork.presets/],
    [{ buttons: { items: [], artwork: { mode: "interval", hours: 0 } } }, /buttons.artwork/],
    [
      { buttons: { items: [{ label: "invalid", href: "/", imageSrc: "javascript:alert(1)" }] } },
      /buttons.items\[0\].imageSrc/
    ],
    [
      { buttons: { items: [{ label: "Empty copy", imageSrc: "/copy.gif", copyText: " \n " }] } },
      /buttons.items\[0\].copyText/
    ],
    [
      { buttons: { items: [{ label: "Unsafe link", imageSrc: "/link.gif", href: "javascript:alert(1)" }] } },
      /buttons.items\[0\].href/
    ],
    [{ wkd: { enabled: true, email: "", publicKeyPath: "public/key.asc" } }, /wkd.email/],
    [{ wkd: { enabled: true, email: "a@example.org", publicKeyPath: "../key.asc" } }, /wkd.publicKeyPath/]
  ];
  for (const [input, field] of cases) {
    assert.throws(
      () => resolveConfig({ site, ...input }),
      (error: Error) => {
        assert.match(error.message, /^entropic.config.ts → /);
        assert.match(error.message, field);
        return true;
      }
    );
  }
});
