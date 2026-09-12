import { textmodeConfig, volumeConfig } from "@/config/server";
import type { ResolvedVolumeConfig } from "@/config/types";
import type { PhileCredit } from "@/features/philes";
import { cellWidth, escapeHtml, link, padCells, textHtml, truncateCells } from "@/shared/textmode";
import { lifeFrameLineHtml, lifeFrameLines } from "@/shared/textmode/life";
import { creditAuthorWidth } from "../credits/presentation";
import type { Volume } from "../model";

const artIndent = textmodeConfig.volumeArtIndent;
const tocRightColumn = textmodeConfig.volumeRightColumn;
const tocInnerWidth = tocRightColumn - 1;
const tocContentWidth = tocInnerWidth - 2;

export function renderVolumePre(volume: Volume, config = volumeConfig(volume.number)): string {
  const toc = renderToc(volume, config);
  const postscript = config.postscript ?? [];

  return `${config.decoration.kind === "life" ? "\n" : ""}${toc}\n\n${textHtml(postscript.join("\n"))}\n`;
}

function renderToc(volume: Volume, config: ResolvedVolumeConfig): string {
  const title = config.subtitle ? `${config.title} - ${config.subtitle}` : config.title;
  const entries = volume.philes.map((phile, index) => ({
    phile,
    index,
    label: entryLabel(volume, index, phile.data.title, phile.data.date, config)
  }));
  const entryLabelWidth = Math.max(0, ...entries.map(({ label }) => cellWidth(label)));
  const badgeWidth = Math.max(
    0,
    ...volume.philes.map((phile) => (phile.credits.length > 1 ? String(phile.credits.length - 1).length + 4 : 0))
  );
  const lines = [
    ...(config.decoration.kind === "life"
      ? [
          ...lifeFrameLines()
            .slice(0, 14)
            .map((_, row) => `${" ".repeat(artIndent)}${lifeFrameLineHtml(row)}`),
          `┌${"─".repeat(artIndent - 1)}${lifeFrameLineHtml(14)}`,
          `│ ${padCells(title, artIndent - 2)}${lifeFrameLineHtml(15)}`,
          `│ ${padCells("                                    CONTENTS", artIndent - 2)}${lifeFrameLineHtml(16)}`
        ]
      : [
          `┌${"─".repeat(tocInnerWidth)}┐`,
          frameLine(title),
          frameLine(`${" ".repeat(Math.max(0, Math.floor((tocContentWidth - 8) / 2)))}CONTENTS`)
        ]),
    frameLine(""),
    ...entries.map(({ phile, index, label }) =>
      renderTocLine(
        config,
        index,
        label,
        phile.data.title,
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
  config: ResolvedVolumeConfig,
  index: number,
  label: string,
  title: string,
  href: string,
  credits: readonly PhileCredit[],
  entryLabelWidth: number,
  badgeWidth: number
): string {
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

function entryLabel(volume: Volume, index: number, title: string, date: Date, config: ResolvedVolumeConfig): string {
  const entryNumber = config.reverseEntryNumbers ? volume.philes.length - index - 1 : index;
  const titleYear = title.match(/^\d{4}\b/)?.[0];

  return config.entryLabel === "year"
    ? (titleYear ?? String(date.getUTCFullYear()))
    : `${config.entryPrefix ?? volume.number}.${entryNumber}`;
}

function frameLine(input: string): string {
  return `│ ${padCells(input, tocContentWidth)} │`;
}
