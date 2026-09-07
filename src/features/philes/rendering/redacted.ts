import { textmodeConfig } from "@/config/server";
import { prepareText, renderPreparedText } from "@/shared/textmode";
import type { Phile } from "../model";

export function renderRedactedBody(phile: Phile): string {
  const lines = [
    "──[ REDACTED ]──────────────────────────────────────────────────────────────────",
    "",
    "  status     : withheld",
    "  access     : denied",
    "  disclosure : pending",
    `  artifact   : ${phile.route.sourcePath}`,
    "",
    "  ┌──────────────────────────────────────────────────────────────────────────┐",
    "  │ This phile exists, but its contents are not mapped into userland yet.    │",
    "  │ The metadata is public; the exploit path remains sealed.                 │",
    "  └──────────────────────────────────────────────────────────────────────────┘",
    "",
    "  reason     : embargo / responsible disclosure",
    "  payload    : [REDACTED]",
    ""
  ];

  return `${renderPreparedText(prepareText(lines.join("\n")), textmodeConfig.bodyWidth)}\n`;
}
