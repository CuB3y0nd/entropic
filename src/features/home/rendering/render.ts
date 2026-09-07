import { homeConfig } from "@/config/server";
import type { HomeItem, HomeSection } from "@/config/types";
import { type Volume, volumeListLabel } from "@/features/volumes";
import { cellWidth, externalLink, link, textHtml, wrapWordsCells } from "@/shared/textmode";

const homeLineWidth = Math.max(...homeConfig.asciiArt.split("\n").map(cellWidth));

export function renderHome(volumes: readonly Volume[]) {
  const lines = homeConfig.sections.flatMap((section) => renderHomeSection(section, volumes));
  return {
    asciiText: homeConfig.asciiArt,
    asciiHtml: textHtml(homeConfig.asciiArt),
    homeText: `${lines.join("\n")}\n`
  };
}

function renderHomeSection(section: HomeSection, allVolumes: readonly Volume[]): string[] {
  const items = renderHomeItems(section, allVolumes);

  if (items.length === 0 && section.volumes?.showEmpty === false) {
    return [];
  }

  const prefix = section.prefix ?? homeConfig.sectionPrefix;
  const title = prefix ? `${prefix} ${section.title}` : section.title;
  return ["", textHtml(title), ...items];
}

function renderHomeItems(section: HomeSection, allVolumes: readonly Volume[]): string[] {
  return [...renderVolumeItems(section, allVolumes), ...(section.items ?? []).flatMap(renderHomeItem)];
}

function renderVolumeItems(section: HomeSection, allVolumes: readonly Volume[]): string[] {
  if (!section.volumes) {
    return [];
  }

  const included = new Set(section.volumes.include);
  const excluded = new Set(section.volumes.exclude);
  const filtered = allVolumes
    .filter((volume) => included.size === 0 || included.has(volume.number))
    .filter((volume) => !excluded.has(volume.number))
    .sort((left, right) =>
      section.volumes?.sort === "desc" ? right.number - left.number : left.number - right.number
    );

  return filtered.flatMap((volume) =>
    renderHomeItem({
      label: volumeListLabel(volume),
      href: volume.href
    })
  );
}

function renderHomeItem(item: HomeItem): string[] {
  const prefix = item.prefix ?? homeConfig.itemPrefix;
  const firstLinePrefix = prefix ? `  ${prefix} ` : "  ";
  const labelWidth = Math.max(1, homeLineWidth - cellWidth(firstLinePrefix));
  const labelLines = wrapWordsCells(item.label, labelWidth);

  return labelLines.map((labelLine, index) => {
    const linePrefix = index === 0 ? firstLinePrefix : " ".repeat(cellWidth(firstLinePrefix));
    return `${textHtml(linePrefix)}${renderLabel(item, labelLine)}`;
  });
}

function renderLabel(item: HomeItem, label: string): string {
  if (!item.href) {
    return textHtml(label);
  }

  if (item.linkLabel) {
    const linkIndex = label.indexOf(item.linkLabel);

    if (linkIndex !== -1) {
      const before = label.slice(0, linkIndex);
      const linked = label.slice(linkIndex, linkIndex + item.linkLabel.length);
      const after = label.slice(linkIndex + item.linkLabel.length);
      const linkedHtml = item.external ? externalLink(item.href, linked) : link(item.href, linked);

      return `${textHtml(before)}${linkedHtml}${textHtml(after)}`;
    }
  }

  return item.external ? externalLink(item.href, label) : link(item.href, label);
}
