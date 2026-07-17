import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/document-parser";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromFile(buffer, file.name);

    return NextResponse.json({
      text,
      fileName: file.name,
      charCount: text.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
