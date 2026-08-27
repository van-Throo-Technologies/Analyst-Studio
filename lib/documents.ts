import "server-only";

// Turning an uploaded file into the plain text the extractor reads.
//
// Every branch must return real prose. Reading a PDF or .docx as UTF-8 yields
// mojibake that looks like text to the type system and like noise to the model,
// so each container format gets a real parser rather than a hopeful decode.

export type ParsedDocument = { filename: string; mimeType: string; content: string };

const TEXT_EXTENSIONS = [".txt", ".md", ".vtt", ".srt", ".csv", ".log", ".json"];

export class UnsupportedFileError extends Error {}
export class EmptyDocumentError extends Error {}

function hasExtension(name: string, extensions: string[]) {
  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

async function readPdf(buffer: ArrayBuffer): Promise<string> {
  // Imported lazily so the PDF machinery is only loaded when a PDF arrives.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

async function readDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  // extractRawText, not convertToHtml: the model wants the words, and markup
  // would just spend context describing formatting nobody asked about.
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return value;
}

export async function parseUpload(file: File): Promise<ParsedDocument> {
  const name = file.name;
  const type = file.type;

  let content: string;
  let mimeType: string;

  if (type === "application/pdf" || hasExtension(name, [".pdf"])) {
    content = await readPdf(await file.arrayBuffer());
    mimeType = "application/pdf";
  } else if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    hasExtension(name, [".docx"])
  ) {
    content = await readDocx(await file.arrayBuffer());
    mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (type.startsWith("text/") || hasExtension(name, TEXT_EXTENSIONS)) {
    content = await file.text();
    mimeType = type || "text/plain";
  } else if (hasExtension(name, [".doc"])) {
    // Legacy binary .doc is a different format from .docx and mammoth does not
    // read it. Saying so beats a confusing parse failure.
    throw new UnsupportedFileError(
      "Legacy .doc files are not supported — re-save it as .docx or PDF and try again.",
    );
  } else {
    throw new UnsupportedFileError(
      `${name || "That file"} is not a supported format. Upload PDF, Word (.docx), or plain text (.txt, .md, .vtt, .srt, .csv).`,
    );
  }

  // A scanned PDF parses without error and yields nothing, because the pages are
  // images. Catching it here gives a message that explains what to do instead.
  if (!content.trim()) {
    throw new EmptyDocumentError(
      mimeType === "application/pdf"
        ? "No text could be read from that PDF. If it is a scan, it needs OCR before it can be used."
        : "That file contains no text.",
    );
  }

  return { filename: name, mimeType, content };
}
