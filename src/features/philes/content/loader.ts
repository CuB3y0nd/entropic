import type { Dirent } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Loader, LoaderContext } from "astro/loaders";
import { type Frontmatter, parsePhile } from "./frontmatter";
import { requiredPhileFields } from "./schema";

export function phileLoader(base = "./src/content/philes"): Loader {
  return {
    name: "phile-loader",
    load: async (context) => {
      const baseDir = path.resolve(fileURLToPath(context.config.root), base);
      const untouched = new Set(context.store.keys());
      const files = await listPhiles(baseDir);

      await Promise.all(files.map((filePath) => syncPhile(context, baseDir, filePath, untouched)));

      for (const id of untouched) {
        context.store.delete(id);
      }

      context.watcher?.add(baseDir);
      context.watcher?.on("change", async (changedPath) => {
        if (isPhilePath(baseDir, changedPath)) {
          await syncPhile(context, baseDir, changedPath, new Set());
        }
      });
      context.watcher?.on("add", async (addedPath) => {
        if (isPhilePath(baseDir, addedPath)) {
          await syncPhile(context, baseDir, addedPath, new Set());
        }
      });
      context.watcher?.on("unlink", (deletedPath) => {
        if (isPhilePath(baseDir, deletedPath)) {
          context.store.delete(idForPath(baseDir, deletedPath));
        }
      });
    }
  };
}

async function syncPhile(
  context: LoaderContext,
  baseDir: string,
  filePath: string,
  untouched: Set<string>
): Promise<void> {
  const source = await fs.readFile(filePath, "utf-8");
  const id = idForPath(baseDir, filePath);
  const { data, body } = parsePhile(source);
  assertRequiredFrontmatter(id, data);
  const parsedData = await context.parseData({ id, data, filePath });
  const relativePath = toPosix(path.relative(fileURLToPath(context.config.root), filePath));

  untouched.delete(id);
  context.store.set({
    id,
    data: parsedData,
    body: parsedData.redacted ? "" : body,
    filePath: relativePath,
    digest: context.generateDigest(source)
  });
}

function assertRequiredFrontmatter(id: string, data: Frontmatter): void {
  const missing = requiredPhileFields.filter((field) => data[field] === undefined);

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `Invalid phile frontmatter in "${id}". Missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`
  );
}

async function listPhiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry: Dirent<string>) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return listPhiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".phile") ? [entryPath] : [];
    })
  );

  return files.flat();
}

function idForPath(baseDir: string, filePath: string): string {
  return toPosix(path.relative(baseDir, filePath));
}

function toPosix(input: string): string {
  return input.split(path.sep).join("/");
}

function isPhilePath(baseDir: string, filePath: string): boolean {
  const relative = path.relative(baseDir, filePath);
  return (
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    relative.endsWith(".phile")
  );
}
