# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.65.0"]
# ///

"""Tune STIX's mathematical rules and radical joins for small web text."""

import hashlib
import json
from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont


LATEST_RELEASE = "https://api.github.com/repos/stipub/stixfonts/releases/latest"
OUTPUT = Path(__file__).resolve().parents[2] / "fonts/EntropicMath-Regular.woff2"


def trim_radical_caps(font: TTFont) -> None:
    variants = font["MATH"].table.MathVariants
    radical = font.getBestCmap()[0x221A]
    construction = variants.VertGlyphConstruction[
        variants.VertGlyphCoverage.glyphs.index(radical)
    ]
    glyphs = font.getGlyphSet()
    charstrings = font["CFF "].cff.topDictIndex[0].CharStrings
    for variant in construction.MathGlyphVariantRecord:
        name = variant.VariantGlyph
        original = charstrings[name]
        outline = RecordingPen()
        glyphs[name].draw(outline)
        points = outline.value
        if (
            len(points) < 5
            or points[0][0] != "moveTo"
            or points[-1][0] != "closePath"
            or any(op != "lineTo" for op, _ in points[1:-1])
        ):
            raise ValueError(f"Unsupported radical contour: {name}")
        tip = points[0][1][0]
        diagonal, lower, upper = [p[1][0] for p in points[-4:-1]]
        if not (
            tip[0] < diagonal[0] < lower[0] == upper[0]
            and diagonal[1] == lower[1] < upper[1] == tip[1]
            and tip[0] < font["hmtx"][name][0] <= upper[0]
        ):
            raise ValueError(f"Unsupported radical cap: {name}")
        # The first point is the diagonal's tip. The final two points extend
        # its horizontal cap, which can snap below MathML's separate overbar.
        advance = tip[0]
        font["hmtx"][name] = (advance, font["hmtx"][name][1])
        # CFF encodes widths relative to nominalWidthX; hmtx uses absolute units.
        pen = T2CharStringPen(advance - original.private.nominalWidthX, glyphs)
        for operation, points in outline.value[:-3]:
            getattr(pen, operation)(*points)
        pen.closePath()
        charstrings[name] = pen.getCharString(
            private=original.private, globalSubrs=original.globalSubrs
        )


def main() -> None:
    with urlopen(LATEST_RELEASE, timeout=30) as response:
        release = json.load(response)["tag_name"]
    upstream = f"https://raw.githubusercontent.com/stipub/stixfonts/{quote(release, safe='')}/"
    source_url = upstream + "fonts/static_otf_woff2/STIXTwoMath-Regular.woff2"
    with urlopen(source_url, timeout=30) as response:
        source = response.read()
    with urlopen(upstream + "OFL.txt", timeout=30) as response:
        license_text = response.read()

    font = TTFont(BytesIO(source), recalcTimestamp=False)
    if font["name"].getDebugName(1) != "STIX Two Math" or "CFF " not in font:
        raise ValueError("Expected a STIX Two Math CFF font")
    # 0.068em exceeds 1px at 16/17px and can snap to a two-pixel bar.
    # 0.05em keeps small rules thin while still scaling with larger formulas.
    for name in (
        "FractionRuleThickness",
        "RadicalRuleThickness",
        "OverbarRuleThickness",
        "UnderbarRuleThickness",
    ):
        getattr(font["MATH"].table.MathConstants, name).Value = round(font["head"].unitsPerEm * 0.05)
    trim_radical_caps(font)

    names = {
        1: "Entropic Math",
        3: f"{release};Entropic;EntropicMath-Regular",
        4: "Entropic Math Regular",
        5: f'{font["name"].getDebugName(5)}; Entropic Math',
        6: "EntropicMath-Regular",
        10: f"Adapted from {source_url}; SHA-256 {hashlib.sha256(source).hexdigest()}",
        16: "Entropic Math",
    }
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    cff = font["CFF "].cff
    cff.fontNames = ["EntropicMath-Regular"]
    cff.topDictIndex[0].FamilyName = "Entropic Math"
    cff.topDictIndex[0].FullName = "Entropic Math Regular"
    output = BytesIO()
    font.save(output)
    OUTPUT.write_bytes(output.getvalue())
    OUTPUT.with_name("STIXTwoMath.LICENSE").write_bytes(license_text)
    print(f"Wrote {OUTPUT} from {release}")


if __name__ == "__main__":
    main()
