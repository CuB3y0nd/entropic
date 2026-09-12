import type { ResolvedConfig } from "../../config/resolve.ts";

type Entry = {
  id: string;
  title: string;
  description: string;
  href: string;
  right: boolean;
  period?: string;
};

type Group = {
  kind: "cve" | "recognition";
  headingId: string;
  year: string;
  label: string;
  entries: Entry[];
};

/** Normalize both record kinds once; rendering and circuit layout share the resulting entries. */
export function buildCveTimeline(content: Pick<ResolvedConfig["cves"], "records" | "recognitions">) {
  const records = [...content.records].sort((a, b) => b.id.localeCompare(a.id, "en", { numeric: true }));
  const recognitions = content.recognitions.filter((recognition) => recognition.enabled !== false);
  const years = new Map<string, Entry[]>();
  records.forEach((record, index) => {
    const year = record.id.slice(4, 8);
    const entries = years.get(year) ?? [];
    entries.push({
      id: record.id,
      title: record.id,
      description: record.title,
      href: `https://www.cve.org/CVERecord?id=${record.id}`,
      right: index % 2 === 1
    });
    years.set(year, entries);
  });
  const groups: Group[] = recognitions.map((recognition) => ({
    kind: "recognition",
    headingId: `recognition-${recognition.id}-heading`,
    year: String(recognition.year),
    label: recognition.organization,
    entries: [
      {
        id: `recognition-${recognition.id}`,
        title: recognition.title,
        description: recognition.recipient,
        href: recognition.href,
        right: false,
        period: `${recognition.year} / ${recognition.period}`
      }
    ]
  }));
  for (const [year, entries] of years) {
    groups.push({
      kind: "cve",
      headingId: `year-${year}`,
      year,
      label: String(entries.length).padStart(2, "0"),
      entries
    });
  }
  return {
    groups: groups.sort((a, b) => Number(b.year) - Number(a.year)),
    summary: recognitions.length
      ? `${records.length} CVEs / ${recognitions.length} ${recognitions.length === 1 ? "recognition" : "recognitions"}`
      : `${records.length} records`
  };
}
