import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) {
    // unpdf ships a serverless PDF.js build — avoids DOMMatrix crashes on Vercel
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = String(text ?? "").trim();
    if (!merged) throw new Error("No readable text found in this PDF.");
    return merged;
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
