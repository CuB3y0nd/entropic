import { textmodeConfig, volumeConfig } from "@/config/server";
import type { PhileCredit } from "@/features/philes";
import { cellWidth, escapeHtml, link, padCells, textHtml, truncateCells } from "@/shared/textmode";
import { lifeFrameLineHtml, lifeFrameLines } from "@/shared/textmode/life";
import { creditAuthorWidth } from "../credits/presentation";
import type { Volume } from "../model";
import { volumeTitle } from "./labels";

const artIndent = textmodeConfig.volumeArtIndent;
const tocRightColumn = textmodeConfig.volumeRightColumn;
const tocInnerWidth = tocRightColumn - 1;
const tocContentWidth = tocInnerWidth - 2;

export function renderVolumePre(volume: Volume): string {
  const toc = renderToc(volume);
  const postscript = volumeConfig(volume.number).postscript ?? [];

  return `\n${toc}\n\n${textHtml(postscript.join("\n"))}\n`;
}

function renderToc(volume: Volume): string {
  const config = volumeConfig(volume.number);
  const title = config.subtitle ? `${volumeTitle(volume)} - ${config.subtitle}` : volumeTitle(volume);
  const lifeLines = lifeFrameLines();
  const entryLabelWidth = Math.max(
    ...volume.philes.map((phile, index) => cellWidth(entryLabel(volume, index, phile.data.title, phile.data.date)))
  );
  const badgeWidth = Math.max(
    0,
    ...volume.philes.map((phile) => (phile.credits.length > 1 ? String(phile.credits.length - 1).length + 4 : 0))
  );
  const lines = [
    ...lifeLines.slice(0, 14).map((_, row) => `${" ".repeat(artIndent)}${lifeFrameLineHtml(row)}`),
    `┌${"─".repeat(artIndent - 1)}${lifeFrameLineHtml(14)}`,
    `│ ${pad(title, artIndent - 2)}${lifeFrameLineHtml(15)}`,
    `│ ${pad("                                    CONTENTS", artIndent - 2)}${lifeFrameLineHtml(16)}`,
    frameLine(""),
    ...volume.philes.map((phile, index) =>
      renderTocLine(
        volume,
        index,
        phile.data.title,
        phile.data.date,
        phile.route.href,
        phile.credits,
        entryLabelWidth,
        badgeWidth
      )
    ),
    frameLine(""),
    `└${"─".repeat(tocInnerWidth)}┘`
  ];

  return lines.join("\n");
}

function renderTocLine(
  volume: Volume,
  index: number,
  title: string,
  date: Date,
  href: string,
  credits: readonly PhileCredit[],
  entryLabelWidth: number,
  badgeWidth: number
): string {
  const config = volumeConfig(volume.number);
  const label = entryLabel(volume, index, title, date);
  const prefix = `${padCells(label, entryLabelWidth)}  `;
  const entryTitle = config.entryLabel === "year" ? title.replace(/^\d{4}\s+/, "") : title;
  const author = credits[0]?.name ?? "";
  const displayAuthor = truncateCells(author, creditAuthorWidth);
  const count = credits.length > 1 ? ` [+${credits.length - 1}]` : "";
  const tail = ` ${displayAuthor}${padCells(count, badgeWidth)}`;
  const trigger = (label: string) =>
    `<button type="button" class="credits-trigger" data-credits-trigger popovertarget="phile-credits-${index}" aria-label="${escapeHtml(`Author and contributors: ${title}`)}">${textHtml(label)}</button>`;
  const authorHtml = displayAuthor !== author ? trigger(displayAuthor) : textHtml(displayAuthor);
  const tailHtml = ` ${authorHtml}${count ? ` ${trigger(count.trimStart())}` : ""}${" ".repeat(badgeWidth - cellWidth(count))}`;
  const titleWidth = Math.max(1, tocInnerWidth - cellWidth(prefix) - cellWidth(tail) - 6);
  const displayTitle = truncateCells(entryTitle, titleWidth);
  const titleLink = link(href, displayTitle);
  const visibleLeft = `${prefix}${displayTitle}`;
  const dots = ".".repeat(Math.max(3, tocInnerWidth - cellWidth(visibleLeft) - cellWidth(tail) - 3));

  return `│ ${escapeHtml(prefix)}${titleLink} ${dots}${tailHtml} │`;
}

function entryLabel(volume: Volume, index: number, title: string, date: Date): string {
  const config = volumeConfig(volume.number);
  const entryNumber = config.reverseEntryNumbers ? volume.philes.length - index - 1 : index;
  const titleYear = title.match(/^\d{4}\b/)?.[0];

  return config.entryLabel === "year"
    ? (titleYear ?? String(date.getUTCFullYear()))
    : `${config.entryPrefix ?? volume.number}.${entryNumber}`;
}

function pad(input: string, width: number): string {
  return padCells(input, width);
}

function frameLine(input: string): string {
  return `│ ${pad(input, tocContentWidth)} │`;
}
