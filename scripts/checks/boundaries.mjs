import { readdir, readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const files = [...(await walk(path.join(root, "src"))), path.join(root, "entropic.config.ts")];
const known = new Set(files);
const graph = new Map();
const browserRoots = new Set();
const errors = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const scripts = file.endsWith(".astro")
    ? [
        { source: /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "", browser: false },
        ...[...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => ({
          source: match[1],
          browser: true
        }))
      ]
    : [{ source: text, browser: /(?:\/client(?:\/|\.ts)|\/glitch\/)/.test(file) }];
  const dependencies = [];
  for (const { source, browser } of scripts) {
    for (const specifier of imports(source)) {
      const target = resolve(file, specifier);
      if (target) {
        dependencies.push(target);
        checkFeatureEntry(file, target);
        if (browser) browserRoots.add(target);
      } else if (isBuiltin(specifier) || specifier === "astro:content") {
        dependencies.push(specifier);
        if (browser) browserRoots.add(specifier);
      }
    }
    if (browser && !file.endsWith(".astro")) browserRoots.add(file);
  }
  graph.set(file, dependencies);
}

for (const entry of browserRoots) {
  const seen = new Set();
  const pending = [entry];
  while (pending.length > 0) {
    const current = pending.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    if (
      isBuiltin(current) ||
      current === "astro:content" ||
      current.endsWith("/server.ts") ||
      current === path.join(root, "entropic.config.ts")
    ) {
      errors.push(`${relative(entry)}: browser dependency reaches ${relative(current)}`);
      continue;
    }
    pending.push(...(graph.get(current) ?? []));
  }
}

if (errors.length > 0) {
  console.error([...new Set(errors)].join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Module interfaces checked across ${files.length} source files; browser imports stay outside server code.`
  );
}

async function walk(directory) {
  const files = await Promise.all(
    (await readdir(directory, { withFileTypes: true })).map((entry) => {
      const filename = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(filename) : /\.(?:ts|js|mjs|astro)$/.test(filename) ? [filename] : [];
    })
  );
  return files.flat();
}

function imports(source) {
  const found = [];
  const ast = ts.createSourceFile("module.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        clause?.isTypeOnly ||
        (!clause?.name &&
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((element) => element.isTypeOnly));
      if (!typeOnly && ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const bindings = node.exportClause;
      const typeOnly =
        bindings &&
        ts.isNamedExports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((element) => element.isTypeOnly);
      if (!typeOnly) found.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}

function resolve(file, specifier) {
  const name = specifier.split("?")[0];
  const base = name.startsWith("@/")
    ? path.join(root, "src", name.slice(2))
    : name.startsWith(".")
      ? path.resolve(path.dirname(file), name)
      : undefined;
  return base
    ? [base, `${base}.ts`, `${base}.js`, path.join(base, "index.ts")].find((candidate) => known.has(candidate))
    : undefined;
}

function relative(file) {
  return file.startsWith(root) ? path.relative(root, file) : file;
}

function checkFeatureEntry(file, target) {
  const feature = /^src\/features\/([^/]+)\/(.+)$/.exec(relative(target));
  if (!feature || relative(file).startsWith(`src/features/${feature[1]}/`)) return;
  const entry = feature[2];
  if (
    ["index.ts", "server.ts", "client.ts", "content/index.ts", "publication.ts"].includes(entry) ||
    /^components\/[^/]+\.astro$/.test(entry)
  )
    return;
  errors.push(`${relative(file)}: import ${relative(target)} through the feature's public entry`);
}
