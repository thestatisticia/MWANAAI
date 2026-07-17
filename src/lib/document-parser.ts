import path from "node:path";
import { pathToFileURL } from "node:url";
import mammoth from "mammoth";

let workerReady = false;

async function getPdfParse() {
  const { PDFParse } = await import("pdf-parse");

  if (!workerReady) {
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs",
    );
    PDFParse.setWorker(pathToFileURL(workerPath).href);
    workerReady = true;
  }

  return PDFParse;
}

export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const PDFParse = await getPdfParse();
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      const text = parsed.text?.trim();
      if (!text) throw new Error("No readable text found in this PDF.");
      return text;
    } finally {
      await parser.destroy();
    }
  }

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim();
    if (!text) throw new Error("No readable text found in this Word document.");
    return text;
  }

  if (lower.endsWith(".doc")) {
    throw new Error(
      "Legacy .doc files are not supported. Please save as .docx or PDF.",
    );
  }

  if (lower.endsWith(".txt")) {
    const text = buffer.toString("utf-8").trim();
    if (!text) throw new Error("The text file is empty.");
    return text;
  }

  throw new Error("Unsupported file type. Upload PDF, DOCX, or TXT.");
}
