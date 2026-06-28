import { type CveRecord, textmodeConfig } from "../../config";
import { externalLink, textHtml } from "../textmode/core/html";
import { cellWidth, padCells, wrapWordsCells } from "../textmode/core/layout";

const innerWidth = textmodeConfig.volumeRightColumn - 1;
const contentWidth = innerWidth - 2;
const descriptionFirstIndent = "  \\_ ";
const descriptionRestIndent = "     ";
const descriptionWidth = contentWidth - Math.max(cellWidth(descriptionFirstIndent), cellWidth(descriptionRestIndent));

export function renderCveRegister(records: CveRecord[]): string {
  const sortedRecords = [...records].sort(compareCveIdsDesc);
  const rows = sortedRecords.flatMap(renderCveRow);
  const lines = ["", frameTop(), ...rows, frameBottom(), "", textHtml(renderStats(sortedRecords.length))];

  return `${lines.join("\n")}\n`;
}

function renderCveRow(record: CveRecord): string[] {
  const descriptionLines = wrapWordsCells(record.title, descriptionWidth);

  return [
    renderRecordMarker(record),
    ...descriptionLines.map((line, index) =>
      frameTextLine(`${index === 0 ? descriptionFirstIndent : descriptionRestIndent}${line}`)
    )
  ];
}

function compareCveIdsDesc(left: CveRecord, right: CveRecord): number {
  const leftId = parseCveId(left.id);
  const rightId = parseCveId(right.id);

  return rightId.year - leftId.year || rightId.sequence - leftId.sequence;
}

function parseCveId(id: CveRecord["id"]): { year: number; sequence: number } {
  const [, year = "0", sequence = "0"] = id.match(/^CVE-(\d+)-(\d+)$/) ?? [];

  return {
    year: Number.parseInt(year, 10),
    sequence: Number.parseInt(sequence, 10)
  };
}

function renderRecordMarker(record: CveRecord): string {
  const visibleText = `[ ${record.id} ] @ ${record.date}`;
  const html = `[ ${externalLink(cveUrl(record.id), record.id)} ] @ ${textHtml(record.date)}`;

  return frameHtmlLine(html, visibleText);
}

function cveUrl(id: CveRecord["id"]): string {
  return `https://www.cve.org/CVERecord?id=${id}`;
}

function renderStats(count: number): string {
  return [
    "  ──[ stats ]────────────────────────────────────────────────────────────────//───",
    "",
    `  ${count} record(s) / linked against cve.org`
  ].join("\n");
}

function frameTop(): string {
  return `┌${"─".repeat(innerWidth)}┐`;
}

function frameBottom(): string {
  return `└${"─".repeat(innerWidth)}┘`;
}

function frameTextLine(input: string): string {
  return `│ ${textHtml(padCells(input, contentWidth))} │`;
}

function frameHtmlLine(html: string, visibleText: string): string {
  return `│ ${html}${" ".repeat(Math.max(0, contentWidth - cellWidth(visibleText)))} │`;
}
