"use server";

import {
  FileParseError,
  MAX_SERVER_PARSE_BYTES,
  parseFile,
} from "@/lib/intake/file-parsers";

/**
 * Converts an uploaded PDF or DOCX to plain text.
 *
 * The file is parsed in memory and never written to disk or stored — only the
 * extracted text comes back, and it lands in the composer's textarea for the
 * analyst to review before anything is saved. There is no upload endpoint and
 * no blob storage: a source is still text, always.
 */

export type ParseFileResult =
  | { ok: true; text: string }
  | { ok: false; message: string };

export async function parseFileAction(
  formData: FormData,
): Promise<ParseFileResult> {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { ok: false, message: "No file was received." };
  }

  if (file.size === 0) {
    return { ok: false, message: `${file.name} is empty.` };
  }

  if (file.size > MAX_SERVER_PARSE_BYTES) {
    return {
      ok: false,
      message: `${file.name} is larger than 10 MB. Split it, or paste the relevant part.`,
    };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = await parseFile(file.name, bytes);
    return { ok: true, text };
  } catch (error) {
    if (error instanceof FileParseError) {
      return { ok: false, message: error.message };
    }
    // Anything else is a fault on our side, not a bad file. Log it rather than
    // blaming the document.
    console.error("Unexpected failure parsing upload", error);
    return {
      ok: false,
      message: `Could not parse ${file.name}. Try pasting the text directly.`,
    };
  }
}
