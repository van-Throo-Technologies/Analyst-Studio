import { NextResponse } from "next/server";
import { getPackOutput } from "@/lib/db/queries";

/**
 * Pack download.
 *
 * A route handler rather than a client-side Blob so the exported file is
 * byte-identical to what is stored — the same bytes the preview renders and the
 * same bytes anyone else downloading this pack receives.
 */

const FORMATS = {
  md: { extension: "md", contentType: "text/markdown; charset=utf-8" },
  html: { extension: "html", contentType: "text/html; charset=utf-8" },
  json: { extension: "json", contentType: "application/json; charset=utf-8" },
} as const;

type Format = keyof typeof FORMATS;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const packId = url.searchParams.get("pack");
  const format = url.searchParams.get("format") as Format | null;

  if (!packId || !format || !(format in FORMATS)) {
    return NextResponse.json(
      { error: "Provide ?pack=<id>&format=md|html|json" },
      { status: 400 },
    );
  }

  const pack = await getPackOutput(packId);
  if (!pack || pack.projectId !== id) {
    return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  }

  const body =
    format === "md"
      ? pack.markdownContent
      : format === "html"
        ? pack.htmlContent
        : pack.jsonContent;

  const { extension, contentType } = FORMATS[format];

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename(pack.title, pack.createdAt)}.${extension}"`,
      "Cache-Control": "no-store",
    },
  });
}

function filename(title: string, createdAt: Date): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${slug}-${createdAt.toISOString().slice(0, 10)}`;
}
