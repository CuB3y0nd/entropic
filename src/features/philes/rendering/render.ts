import { decodeHTMLAttribute } from "entities/decode";
import { textmodeConfig } from "@/config/server";
import { escapeHtml, link, textHtml, trimBlankLines, wrapWordsCells } from "@/shared/textmode";
import { renderAnsiText } from "@/shared/textmode/ansi";
import { lifeFrameHeight, lifeFrameHtml } from "@/shared/textmode/life";
import { safeUrl } from "@/shared/urls";
import type { Phile } from "../model";
import { renderRedactedBody } from "./redacted";

const titleWidth = textmodeConfig.articleArtIndent - textmodeConfig.textIndent;

export type PhileHeader = {
  metaHtml: string;
  sideHtml: string;
  lineCount: number;
  metaLineCount: number;
  titleLineCount: number;
};

export type PhileBodyBlock = {
  kind: "text" | "image";
  html: string;
};

export type PhileView = {
  header: PhileHeader;
  body: { kind: "redacted"; html: string } | { kind: "content"; blocks: PhileBodyBlock[] };
  footerHtml: string;
};

/** The publishing decision belongs here, so callers never render a withheld body. */
export function renderPhile(phile: Phile): PhileView {
  const withheld = phile.data.redacted || (phile.body ?? "").trim().length === 0;
  return {
    header: renderPhileHeader(phile),
    body: withheld
      ? { kind: "redacted", html: renderRedactedBody(phile) }
      : { kind: "content", blocks: renderPhileBodyBlocks(phile) },
    footerHtml: renderPhileFooterPre(phile)
  };
}

function renderPhileHeader(phile: Phile): PhileHeader {
  const titleLines = wrapWordsCells(phile.data.title, titleWidth);
  const author = phile.credits[0];
  const metaLines = [...titleLines, ...(author ? wrapWordsCells(`~ ${author.name}`, titleWidth) : [])];

  return {
    metaHtml: metaLines.map(textHtml).join("\n"),
    sideHtml: lifeFrameHtml(),
    lineCount: lifeFrameHeight,
    metaLineCount: metaLines.length,
    titleLineCount: titleLines.length
  };
}

function renderPhileBodyBlocks(phile: Phile): PhileBodyBlock[] {
  return splitBodyBlocks(phile.body ?? "").map((block) => {
    if (block.kind === "image") {
      return {
        kind: "image",
        html: renderImage(block.src, block.alt)
      };
    }

    return {
      kind: "text",
      html: `${renderAnsiText(block.text, textmodeConfig.bodyWidth)}\n`
    };
  });
}

function renderPhileFooterPre(phile: Phile): string {
  return `\n\nret ${link(phile.route.volumeHref, `<volume_${phile.route.volume}>`)}\n`;
}

type ParsedBodyBlock = { kind: "text"; text: string } | { kind: "image"; src: string; alt: string };

function splitBodyBlocks(input: string): ParsedBodyBlock[] {
  const blocks: ParsedBodyBlock[] = [];
  const textLines: string[] = [];

  for (const line of input.split("\n")) {
    const image = parseImageLine(line);

    if (!image) {
      textLines.push(line);
      continue;
    }

    flushTextBlock(blocks, textLines);
    blocks.push({ kind: "image", ...image });
  }

  flushTextBlock(blocks, textLines);
  return blocks;
}

function flushTextBlock(blocks: ParsedBodyBlock[], textLines: string[]): void {
  const text = trimBlankLines(textLines.join("\n"));

  if (text.length > 0) {
    blocks.push({ kind: "text", text });
  }

  textLines.length = 0;
}

function parseImageLine(line: string): { src: string; alt: string } | undefined {
  const markdownImage = line.match(/^\s*!\[([^\]]*)\]\((\S+?)(?:\s+["'][^"']*["'])?\)\s*$/);

  if (markdownImage?.[2]) {
    return {
      alt: markdownImage[1] ?? "",
      src: markdownImage[2]
    };
  }

  const htmlImage = line.match(/^\s*<img\b([^>]*)>\s*$/i);

  if (!htmlImage) {
    return undefined;
  }

  const attrs = htmlImage[1] ?? "";
  const src = readHtmlAttr(attrs, "src");

  if (!src) {
    return undefined;
  }

  return {
    src,
    alt: readHtmlAttr(attrs, "alt") ?? ""
  };
}

function readHtmlAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? undefined : decodeHTMLAttribute(value);
}

function renderImage(src: string, alt: string): string {
  const safeSrc = escapeHtml(safeUrl(src, "image"));
  const safeAlt = escapeHtml(alt);
  const caption = alt.trim().length > 0 ? `\n<figcaption>${textHtml(alt)}</figcaption>` : "";

  return `<figure class="phile-image"><button class="phile-image-trigger" type="button" data-lightbox-image aria-label="Open image preview"><img src="${safeSrc}" alt="${safeAlt}" loading="lazy" decoding="async" /></button>${caption}</figure>`;
}
