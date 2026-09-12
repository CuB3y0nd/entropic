import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveConfig } from "../../src/config/resolve.ts";
import type { CveRecord, ResearchRecognition } from "../../src/config/types.ts";
import { buildCveTimeline } from "../../src/features/cves/model.ts";

const site = { url: "https://example.org/", name: "Example", description: "Research" };
const records: readonly CveRecord[] = [
  { id: "CVE-2025-10000", title: "Older record" },
  { id: "CVE-2026-9999", title: "Lower numeric ID" },
  { id: "CVE-2026-10000", title: "Higher numeric ID" }
];
const recognition: ResearchRecognition = {
  id: "msrc-2027",
  year: 2027,
  organization: "MSRC",
  title: "Special Mention",
  recipient: "A Researcher (@example)",
  period: "Jul '26 – Jun '27",
  href: "https://example.org/recognition"
};

test("recognitions share chronology without changing CVE ordering, counts or alternating sides", () => {
  const content = { records, recognitions: [recognition, { ...recognition, id: "previous-cycle", year: 2026 }] };
  const before = structuredClone(content);
  const timeline = buildCveTimeline(content);
  assert.deepEqual(
    timeline.groups.map(({ year, kind }) => [year, kind]),
    [
      ["2027", "recognition"],
      ["2026", "recognition"],
      ["2026", "cve"],
      ["2025", "cve"]
    ]
  );
  assert.deepEqual(
    timeline.groups
      .filter((group) => group.kind === "cve")
      .flatMap((group) => group.entries)
      .map(({ id, right }) => [id, right]),
    [
      ["CVE-2026-10000", false],
      ["CVE-2026-9999", true],
      ["CVE-2025-10000", false]
    ]
  );
  assert.deepEqual(
    timeline.groups.filter((group) => group.kind === "cve").map((group) => group.label),
    ["02", "01"]
  );
  assert.equal(timeline.summary, "3 CVEs / 2 recognitions");
  assert.deepEqual(content, before, "The editable configuration is not reordered or mutated");
});

test("a disabled recognition remains configured but contributes no heading, node or count", () => {
  const content = resolveConfig({
    site,
    cves: { enabled: true, records, recognitions: [{ ...recognition, enabled: false }] }
  }).cves;
  const timeline = buildCveTimeline(content);
  assert.equal(content.recognitions.length, 1);
  assert.equal(
    timeline.groups.some((group) => group.kind === "recognition"),
    false
  );
  assert.equal(timeline.summary, "3 records");
  const enabled = buildCveTimeline({ ...content, recognitions: [{ ...recognition, enabled: true }] });
  assert.equal(enabled.groups[0]?.entries[0]?.id, "recognition-msrc-2027");
  assert.equal(enabled.summary, "3 CVEs / 1 recognition");
});

test("empty and recognition-only timelines retain accurate totals and configured content", () => {
  assert.deepEqual(buildCveTimeline({ records: [], recognitions: [] }), { groups: [], summary: "0 records" });
  const timeline = buildCveTimeline({ records: [], recognitions: [recognition] });
  assert.equal(timeline.summary, "0 CVEs / 1 recognition");
  assert.deepEqual(timeline.groups[0]?.entries[0], {
    id: "recognition-msrc-2027",
    title: recognition.title,
    description: recognition.recipient,
    href: recognition.href,
    period: "2027 / Jul '26 – Jun '27",
    right: false
  });
});

test("recognition spacing inherits half a line and preserves explicit zero and fractional choices", () => {
  const resolveGap = (recognitionPeriodGapLines?: number) =>
    resolveConfig({ site, cves: { enabled: true, recognitionPeriodGapLines } }).cves.recognitionPeriodGapLines;
  assert.equal(resolveGap(), 0.5);
  for (const gap of [0, 0.25, 0.5, 1, 2]) assert.equal(resolveGap(gap), gap);
  for (const gap of [-1, 2.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => resolveGap(gap), /cves.recognitionPeriodGapLines/);
  }
});

test("recognition validation rejects duplicate anchors, invalid years and unsafe links", () => {
  const resolve = (recognitions: readonly ResearchRecognition[]) =>
    resolveConfig({ site, cves: { enabled: true, recognitions } });
  assert.throws(() => resolve([recognition, recognition]), /cves.recognitions\[1\].id/);
  assert.throws(() => resolve([{ ...recognition, year: 2027.5 }]), /cves.recognitions\[0\].year/);
  assert.throws(() => resolve([{ ...recognition, href: "javascript:alert(1)" }]), /cves.recognitions\[0\].href/);
});
