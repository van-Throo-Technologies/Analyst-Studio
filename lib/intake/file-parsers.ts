import "server-only";
import path from "node:path";

/**
 * Server-side extraction of plain text from PDF and DOCX.
 *
 * These formats cannot be read in the browser the way `.txt` can, so intake
 * routes them here. The contract is deliberately narrow: bytes in, plain text
 * out. No layout, no styling, no structure — a source document in Analyst
 * Studio is text, and everything downstream depends on that staying true.
 *
 * Both libraries are heavy and Node-only; they are imported lazily inside each
 * parser so a request that never touches a PDF never pays for loading pdfjs.
 */

/** Extensions handled here rather than client-side. */
export const SERVER_PARSED_EXTENSIONS = [".pdf", ".docx", ".doc"] as const;

/** PDFs are routinely larger than pasted notes, so they get their own ceiling. */
export const MAX_SERVER_PARSE_BYTES = 10 * 1024 * 1024;

export class FileParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileParseError";
  }
}

export function needsServerParsing(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return (SERVER_PARSED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Extracts text from a PDF.
 *
 * Uses the legacy build, which is the one that runs under Node. Rendering is
 * never invoked — only `getTextContent` — so there is no canvas dependency.
 * Font data is pointed at the package's own directory to avoid a warning on
 * every parse; it is not otherwise needed for text extraction.
 */
export async function extractTextFromPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const standardFontDataUrl = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/standard_fonts/",
  );

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    // No remote fetches and no font rendering: this runs on our server against
    // a user-supplied file, and neither is needed to read text.
    useWorkerFetch: false,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl,
  });

  try {
    const doc = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();

      // pdfjs emits positioned fragments, not lines. `hasEOL` is the only
      // reliable line signal it gives us; without honouring it the whole page
      // collapses into one unreadable paragraph.
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        if (item.hasEOL) text += "\n";
      }

      pages.push(text.trimEnd());
      page.cleanup();
    }

    const joined = pages
      .filter((page) => page.trim().length > 0)
      .join("\n\n")
      .trim();

    if (joined.length === 0) {
      throw new FileParseError(
        "This PDF contains no extractable text. It is most likely a scan — the text would need OCR, which is not supported.",
      );
    }

    return normaliseWhitespace(joined);
  } catch (error) {
    if (error instanceof FileParseError) throw error;
    throw new FileParseError(
      "Could not parse this PDF. It may be corrupted or password-protected.",
    );
  } finally {
    // Always release the worker, including on the throw paths above.
    await loadingTask.destroy().catch(() => {});
  }
}

/**
 * Extracts text from a DOCX.
 *
 * `.doc` (the pre-2007 binary format) is not supported by mammoth and is
 * rejected with a message that says so rather than failing obscurely.
 */
export async function extractTextFromDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = (await import("mammoth")).default;

  try {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(bytes),
    });

    const text = normaliseWhitespace(result.value.trim());
    if (text.length === 0) {
      throw new FileParseError("This document appears to be empty.");
    }
    return text;
  } catch (error) {
    if (error instanceof FileParseError) throw error;
    throw new FileParseError(
      "Could not parse this document. It may be corrupted, or saved in the older .doc format — re-save it as .docx and try again.",
    );
  }
}

/** Routes a file to the right parser by extension. */
export async function parseFile(
  filename: string,
  bytes: Uint8Array,
): Promise<string> {
  if (bytes.byteLength > MAX_SERVER_PARSE_BYTES) {
    throw new FileParseError(
      `${filename} is larger than 10 MB. Split it, or paste the relevant part.`,
    );
  }

  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case ".pdf":
      return extractTextFromPdf(bytes);
    case ".docx":
      return extractTextFromDocx(bytes);
    case ".doc":
      throw new FileParseError(
        "The older .doc format is not supported. Open it and re-save as .docx, or paste the text directly.",
      );
    default:
      throw new FileParseError(
        `${filename} is not a file type this app can convert. Supported: PDF and DOCX.`,
      );
  }
}

/**
 * Collapses the artefacts extraction leaves behind — non-breaking spaces,
 * trailing spaces, runs of blank lines — without touching the words. Source
 * content is stored verbatim, so this is the only cleanup that happens, and it
 * only removes things the original document did not really contain.
 */
function normaliseWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}
