import { execFileSync } from "node:child_process";
import { parsePhile } from "../../src/features/philes/content/frontmatter";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });
const staged = git("diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR", "--", "*.phile")
  .split("\0")
  .filter(Boolean);

// Parse every candidate first: invalid YAML must not result in a partially modified index.
const redacted = staged.filter((file) => parsePhile(git("show", `:${file}`)).data.redacted === true);
if (redacted.length > 0) {
  let hasHead = false;
  try {
    git("rev-parse", "--verify", "HEAD");
    hasHead = true;
  } catch {
    // A repository's first commit has no HEAD to restore from.
  }
  for (const file of redacted) {
    if (hasHead) {
      git("restore", "--staged", "--", file);
    } else {
      git("update-index", "--force-remove", "--", file);
    }
    console.error(`pre-commit: unstaged redacted phile ${JSON.stringify(file)}`);
  }
}
