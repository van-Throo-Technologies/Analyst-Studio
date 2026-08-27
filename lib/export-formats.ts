import "server-only";

import type { Pack, PackSection, PackEntry } from "./pack-generator";

// One pack, four renderings. Each target has its own conventions and the point
// of exporting is to land in that tool looking native — Jira's wiki markup is
// not Confluence's storage format, and neither is Markdown.

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function exportFilename(pack: Pack, extension: string) {
  return `${slug(pack.projectName)}-${pack.kind}-pack.${extension}`;
}

/** Sections with nothing in them still appear, carrying their empty note — an
 *  absent section reads as an oversight, a noted gap reads as a finding. */
function sectionIsEmpty(section: PackSection) {
  return (
    (section.body?.length ?? 0) === 0 &&
    (section.bullets?.length ?? 0) === 0 &&
    (section.entries?.length ?? 0) === 0
  );
}

// ---------------------------------------------------------------- Markdown

export function exportToMarkdown(pack: Pack): string {
  const out: string[] = [];

  out.push(`# ${pack.projectName}`);
  out.push(`## ${pack.title}`);
  out.push("");
  out.push(`_${pack.summary}_`);
  out.push("");
  out.push(`**For:** ${pack.generatedFor}  `);
  out.push(`**Requirements:** ${pack.requirementCount}`);
  out.push("");

  for (const section of pack.sections) {
    out.push(`## ${section.heading}`);
    out.push("");

    if (sectionIsEmpty(section)) {
      out.push(`> ${section.emptyNote}`);
      out.push("");
      continue;
    }

    for (const paragraph of section.body ?? []) {
      out.push(paragraph);
      out.push("");
    }

    for (const bullet of section.bullets ?? []) {
      out.push(`- ${bullet}`);
    }
    if ((section.bullets?.length ?? 0) > 0) out.push("");

    for (const item of section.entries ?? []) {
      out.push(`### ${item.title}`);
      out.push("");
      out.push(`\`${item.type}\` · \`${item.priority}\` · \`${item.scope}\` · ${item.completionScore}% specified`);
      out.push("");
      out.push(item.description);
      out.push("");
      for (const detail of item.details) {
        out.push(`**${detail.label}**`);
        out.push("");
        for (const line of detail.items) out.push(`- ${line}`);
        out.push("");
      }
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// -------------------------------------------------------------------- Jira

// Jira text formatting: h1./h2. headings, * bullets, {{monospace}}, *bold*.
export function exportToJira(pack: Pack): string {
  const out: string[] = [];

  out.push(`h1. ${pack.projectName} — ${pack.title}`);
  out.push("");
  out.push(`_${pack.summary}_`);
  out.push("");
  out.push(`*For:* ${pack.generatedFor}`);
  out.push(`*Requirements:* ${pack.requirementCount}`);
  out.push("");

  for (const section of pack.sections) {
    out.push(`h2. ${section.heading}`);
    out.push("");

    if (sectionIsEmpty(section)) {
      out.push(`{quote}${section.emptyNote}{quote}`);
      out.push("");
      continue;
    }

    for (const paragraph of section.body ?? []) {
      out.push(paragraph);
      out.push("");
    }

    for (const bullet of section.bullets ?? []) out.push(`* ${bullet}`);
    if ((section.bullets?.length ?? 0) > 0) out.push("");

    for (const item of section.entries ?? []) {
      out.push(`h3. ${item.title}`);
      out.push(
        `{{${item.type}}} {{${item.priority}}} {{${item.scope}}} — ${item.completionScore}% specified`,
      );
      out.push("");
      out.push(item.description);
      out.push("");
      for (const detail of item.details) {
        out.push(`*${detail.label}*`);
        for (const line of detail.items) out.push(`** ${line}`);
        out.push("");
      }
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// -------------------------------------------------------------- Confluence

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Confluence storage format — the XHTML Confluence stores pages as. Pasting
// this into the editor's source view reproduces the structure natively.
export function exportToConfluence(pack: Pack): string {
  const out: string[] = [];

  out.push(`<h1>${escapeXml(pack.projectName)} — ${escapeXml(pack.title)}</h1>`);
  out.push(`<p><em>${escapeXml(pack.summary)}</em></p>`);
  out.push(
    `<p><strong>For:</strong> ${escapeXml(pack.generatedFor)}<br /><strong>Requirements:</strong> ${pack.requirementCount}</p>`,
  );

  for (const section of pack.sections) {
    out.push(`<h2>${escapeXml(section.heading)}</h2>`);

    if (sectionIsEmpty(section)) {
      out.push(
        `<ac:structured-macro ac:name="info"><ac:rich-text-body><p>${escapeXml(section.emptyNote)}</p></ac:rich-text-body></ac:structured-macro>`,
      );
      continue;
    }

    for (const paragraph of section.body ?? []) {
      out.push(`<p>${escapeXml(paragraph)}</p>`);
    }

    if ((section.bullets?.length ?? 0) > 0) {
      out.push("<ul>");
      for (const bullet of section.bullets ?? []) out.push(`<li>${escapeXml(bullet)}</li>`);
      out.push("</ul>");
    }

    for (const item of section.entries ?? []) {
      out.push(`<h3>${escapeXml(item.title)}</h3>`);
      out.push(
        `<p><code>${escapeXml(item.type)}</code> <code>${escapeXml(item.priority)}</code> <code>${escapeXml(item.scope)}</code> — ${item.completionScore}% specified</p>`,
      );
      out.push(`<p>${escapeXml(item.description)}</p>`);
      for (const detail of item.details) {
        out.push(`<p><strong>${escapeXml(detail.label)}</strong></p>`);
        out.push("<ul>");
        for (const line of detail.items) out.push(`<li>${escapeXml(line)}</li>`);
        out.push("</ul>");
      }
    }
  }

  return out.join("\n") + "\n";
}

// --------------------------------------------------------------------- PDF

const INK = "#1e293b";
const MUTED = "#64748b";
const BRAND = "#0052ff";

export async function exportToPDF(pack: Pack): Promise<Buffer> {
  // Required lazily: pdfkit reads its font metrics from disk at import time,
  // which should not happen unless a PDF is actually being made.
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Standard-14 fonts only — no font file to ship, and no licence question.
    doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text(pack.projectName);
    doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(14).fillColor(BRAND).text(pack.title);
    doc.moveDown(0.6);
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED).text(pack.summary);
    doc.moveDown(0.3);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(`For: ${pack.generatedFor}`)
      .text(`Requirements: ${pack.requirementCount}`);
    doc.moveDown(1);

    for (const section of pack.sections) {
      // Start a new page rather than orphan a heading at the foot of one.
      if (doc.y > doc.page.height - 160) doc.addPage();

      doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(section.heading);
      doc.moveDown(0.4);

      if (sectionIsEmpty(section)) {
        doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(MUTED).text(section.emptyNote);
        doc.moveDown(0.9);
        continue;
      }

      for (const paragraph of section.body ?? []) {
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(paragraph);
        doc.moveDown(0.35);
      }

      for (const bullet of section.bullets ?? []) {
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(`•  ${bullet}`, { indent: 8 });
        doc.moveDown(0.15);
      }

      for (const item of section.entries ?? []) {
        if (doc.y > doc.page.height - 130) doc.addPage();

        doc.moveDown(0.35);
        doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(item.title);
        doc
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(MUTED)
          .text(`${item.type} · ${item.priority} · ${item.scope} · ${item.completionScore}% specified`);
        doc.moveDown(0.25);
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(item.description);

        for (const detail of item.details) {
          doc.moveDown(0.25);
          doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(detail.label);
          for (const line of detail.items) {
            doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(`•  ${line}`, { indent: 8 });
          }
        }
        doc.moveDown(0.3);
      }

      doc.moveDown(0.7);
    }

    // Page numbers, added once the total is known.
    //
    // The footer sits below the bottom margin, and writing there makes pdfkit
    // think the page is full and start a new one — which would append a blank
    // page per footer and double the document. Dropping the bottom margin for
    // the duration of the write is what keeps it on the page it belongs to.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);

      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `${pack.projectName} · ${pack.title} · ${i + 1} of ${range.count}`,
          56,
          doc.page.height - 40,
          { align: "center", width: doc.page.width - 112, lineBreak: false },
        );

      doc.page.margins.bottom = bottomMargin;
    }

    doc.end();
  });
}
