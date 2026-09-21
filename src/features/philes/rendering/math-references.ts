import { escapeHtml } from "@/shared/textmode";

// The subset of Temml's MathML tree used before serialization. Temml is pinned;
// keeping this pass on its tree avoids a DOM dependency or browser post-processing.
export type MathTree = {
  type?: string;
  attributes?: Record<string, string>;
  style?: Record<string, string>;
  classes?: string[];
  children?: MathTree[];
  label?: string;
  href?: string;
  text?: string;
  toMarkup(): string;
};

export function resolveEquationReferences(trees: MathTree[]): void {
  const rows = new Map<MathTree, string>();
  const tables = new Set<MathTree>();
  const labels = new Map<string, MathTree[]>();
  const references: { node: MathTree; inMath: boolean }[] = [];
  const ancestors: MathTree[] = [];
  let number = 0;

  const visit = (node: MathTree) => {
    if (node.type === "annotation") return;
    if (node.classes?.includes("tml-eqn") || node.classes?.includes("tml-tag")) {
      const row = ancestors.findLast((parent) => parent.type === "mtr");
      if (row) {
        const table = ancestors.findLast((parent) => parent.type === "mtable");
        if (table) tables.add(table);
        let tag = treeText(node);
        if (node.classes.includes("tml-eqn")) {
          tag = `(${++number})`;
          // Emit the number as real text, without the upstream CSS counter.
          node.toMarkup = () => escapeHtml(tag);
        }
        rows.set(row, tag);
        row.classes?.push("phile-equation-row");
      }
    }
    if (node.classes?.includes("tml-label")) {
      const label = node.label ?? "";
      if (!label) throw new Error("Equation labels must contain letters, numbers, underscores or hyphens.");
      if (labels.has(label)) throw new Error(`Duplicate equation label: ${label}`);
      labels.set(label, [...ancestors, node]);
    }
    if (node.classes?.includes("tml-ref")) {
      references.push({ node, inMath: ancestors.some((parent) => parent.type === "math") });
    }
    ancestors.push(node);
    for (const child of node.children ?? []) visit(child);
    ancestors.pop();
  };
  for (const tree of trees) visit(tree);

  for (const table of tables) layoutEquationTable(table);
  for (const row of rows.keys()) {
    if (row.attributes?.id) row.attributes.id = `equation-${row.attributes.id}`;
  }
  const targets = new Map<string, { id: string; tag: string | undefined }>();
  for (const [label, parents] of labels) {
    const row = parents.findLast((parent) => rows.has(parent));
    const target = row ?? parents[parents.length - 1];
    if (!target?.attributes) continue;
    const id = row?.attributes?.id ?? `equation-${label}`;
    target.attributes.id = id;
    targets.set(label, { id, tag: row ? rows.get(row) : undefined });
  }

  for (const { node, inMath } of references) {
    const label = node.href?.slice(1) ?? "";
    const target = targets.get(label);
    if (!target) throw new Error(`Unknown equation reference: ${label}`);
    if (target.tag === undefined) {
      throw new Error(`Equation ${label} has no number. Use an equation environment or \\tag{...}.`);
    }
    const tag = target.tag.replace(/^\(/, "").replace(/\)$/, "");
    const text = node.classes?.includes("tml-eqref") ? `(${tag})` : tag;
    const html = `<a class="phile-equation-ref" href="#${escapeHtml(target.id)}">${escapeHtml(text)}</a>`;
    // HTML links belong inside a MathML text integration point, not an mrow.
    node.toMarkup = () => (inMath ? `<mtext>${html}</mtext>` : html);
  }
}

function layoutEquationTable(table: MathTree): void {
  table.classes?.push("phile-equation-table");
  // Firefox cannot resolve a percentage table width through <semantics>.
  // Container units retain the TeX annotation and work without layout scripts.
  if (table.style) table.style.width = "100cqw";
  for (const row of table.children ?? []) {
    if (row.type !== "mtr" || !row.children) continue;
    // Temml adds empty leading glue and a trailing tag cell to every row.
    row.children.shift();
    const first = row.children[0];
    const tag = row.children[row.children.length - 1];
    if (first?.style) first.style.paddingLeft = "0";
    if (tag?.style) {
      tag.style.width = "100%";
      tag.style.paddingLeft = "0.5em";
      tag.classes?.push("tml-right");
    }
  }
}

function treeText(node: MathTree): string {
  return node.text ?? node.children?.map(treeText).join("") ?? "";
}
