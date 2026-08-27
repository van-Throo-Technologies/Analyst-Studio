import { generatePack } from "../../../../../../lib/pack-generator";
import {
  exportToMarkdown,
  exportToJira,
  exportToConfluence,
  exportToPDF,
  exportFilename,
} from "../../../../../../lib/export-formats";

// One handler rather than four near-identical files. The URLs are unchanged —
// /export/markdown, /export/pdf, /export/jira, /export/confluence — the format
// is simply read from the path instead of being duplicated four times.

// PDF assembly is CPU work over a whole pack; the default would usually do, but
// a large pack on a cold instance should not be cut off mid-document.
export const maxDuration = 60;

const FORMATS = {
  markdown: { extension: "md", contentType: "text/markdown; charset=utf-8" },
  jira: { extension: "txt", contentType: "text/plain; charset=utf-8" },
  confluence: { extension: "xml", contentType: "text/plain; charset=utf-8" },
  pdf: { extension: "pdf", contentType: "application/pdf" },
} as const;

type Format = keyof typeof FORMATS;

function isFormat(value: string): value is Format {
  return value in FORMATS;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; format: string }> },
) {
  const { id, format } = await params;

  if (!isFormat(format)) {
    return Response.json(
      { error: `Unknown export format "${format}". Use markdown, pdf, jira or confluence.` },
      { status: 404 },
    );
  }

  const packType = new URL(request.url).searchParams.get("packType") ?? "ba";
  if (packType !== "ba" && packType !== "fa") {
    return Response.json({ error: 'packType must be "ba" or "fa".' }, { status: 400 });
  }

  // generatePack verifies the session and scopes to the caller's own projects.
  const pack = await generatePack(id, packType);
  if (!pack) {
    return Response.json({ error: "That project could not be found." }, { status: 404 });
  }

  const { extension, contentType } = FORMATS[format];
  const filename = exportFilename(pack, extension);

  const body =
    format === "pdf"
      ? new Uint8Array(await exportToPDF(pack))
      : format === "markdown"
        ? exportToMarkdown(pack)
        : format === "jira"
          ? exportToJira(pack)
          : exportToConfluence(pack);

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
