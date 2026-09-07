import assert from "node:assert/strict";
import { test } from "node:test";
import { appearanceConfig } from "../../src/config/server";
import { appearanceCssVariables } from "../../src/shared/textmode/core/css-vars";

test("theme values cannot terminate the generated style element", () => {
  assert.throws(() =>
    appearanceCssVariables({
      ...appearanceConfig,
      colors: { ...appearanceConfig.colors, background: "red;}</style><script>alert(1)</script>" }
    })
  );
  const css = appearanceCssVariables({
    ...appearanceConfig,
    fonts: { ...appearanceConfig.fonts, asciiUrl: "/font</style>.woff" }
  });
  assert.doesNotMatch(css, /<\/style>/);
});
