import type { Pack } from "@/lib/pack-builders/types";
import { isBaPack } from "@/lib/pack-builders/types";
import { renderPackMarkdown } from "@/lib/pack-builders/markdown";

/**
 * Print-friendly HTML.
 *
 * Rendered from the same Markdown the .md export produces, so the two can never
 * drift. The Markdown subset used by the renderer is small and known — headings,
 * bold, italic, lists, tables, horizontal rules — so a tiny purpose-built
 * converter is more predictable here than a general Markdown library, and adds
 * no dependency to ship a document.
 *
 * The output is a single self-contained file: no external stylesheet, no fonts,
 * no scripts. It opens in a browser, prints to PDF cleanly, and can be emailed
 * as one attachment.
 */
export function renderPackHtml(pack: Pack): string {
  const markdown = renderPackMarkdown(pack);
  const title = `${pack.meta.projectName} — ${isBaPack(pack) ? "Business" : "Functional"} Analysis Pack`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<main class="pack">
${markdownToHtml(markdown)}
</main>
</body>
</html>
`;
}

const STYLES = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #f6f6f4;
  color: #1a1a18;
  font: 16px/1.65 ui-serif, Georgia, "Times New Roman", serif;
}
.pack {
  max-width: 46rem;
  margin: 0 auto;
  padding: 4rem 2.5rem 6rem;
  background: #fff;
  min-height: 100vh;
}
h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 1.5rem; letter-spacing: -0.01em; }
h2 {
  font-size: 1.25rem;
  margin: 2.75rem 0 1rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid #e3e3df;
  letter-spacing: -0.005em;
}
h3 { font-size: 1.05rem; margin: 1.75rem 0 0.6rem; }
p { margin: 0 0 0.9rem; }
ul, ol { margin: 0 0 1rem; padding-left: 1.4rem; }
li { margin-bottom: 0.3rem; }
em { color: #4a4a45; }
hr { border: 0; border-top: 1px solid #e3e3df; margin: 2.5rem 0; }
code { font: 0.875em ui-monospace, SFMono-Regular, monospace; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
th, td { text-align: left; vertical-align: top; padding: 0.5rem 0.7rem; border-bottom: 1px solid #e3e3df; }
th { font-weight: 600; background: #fafaf9; border-bottom-color: #cfcfc9; }
.table-scroll { overflow-x: auto; }
@media print {
  body { background: #fff; font-size: 11pt; }
  .pack { max-width: none; padding: 0; }
  h1, h2, h3 { break-after: avoid; }
  li, tr, table { break-inside: avoid; }
  a { text-decoration: none; color: inherit; }
  @page { margin: 18mm 16mm; }
}
`;

/**
 * Converts the Markdown subset emitted by markdown.ts. Anything outside that
 * subset is escaped and rendered as plain text rather than silently dropped.
 */
function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    if (line.startsWith("---")) {
      out.push("<hr>");
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    // Table: a header row followed by a separator row.
    if (line.startsWith("|") && lines[index + 1]?.match(/^\|[\s|:-]+\|$/)) {
      const headers = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].startsWith("|")) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      out.push(
        [
          '<div class="table-scroll"><table>',
          `<thead><tr>${headers.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>`,
          `<tbody>${rows
            .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody>`,
          "</table></div>",
        ].join(""),
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s/, ""));
        index += 1;
      }
      out.push(`<ol>${items.map((i) => `<li>${inline(i)}</li>`).join("")}</ol>`);
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2));
        index += 1;
      }
      out.push(`<ul>${items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
      continue;
    }

    // Paragraph: consume until a blank line. A trailing double space is a
    // hard line break in the Markdown we generate.
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim().length > 0) {
      const current = lines[index];
      if (
        current.startsWith("#") ||
        current.startsWith("- ") ||
        current.startsWith("|") ||
        current.startsWith("---") ||
        /^\d+\.\s/.test(current)
      ) {
        break;
      }
      paragraph.push(current);
      index += 1;
    }
    out.push(
      `<p>${paragraph
        .map((p) => inline(p.replace(/\s{2,}$/, "")))
        .join("<br>")}</p>`,
    );
  }

  return out.join("\n");
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/** Escape first, then apply the inline markers — order matters for safety. */
function inline(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w`])_([^_]+)_(?=[^\w]|$)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
