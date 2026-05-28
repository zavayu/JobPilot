import fs from "node:fs/promises";
import mammoth from "mammoth";

export async function extractResumeText(filePath: string, fileType: "pdf" | "docx"): Promise<string> {
  if (fileType === "docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  }

  const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  return parsed.text.trim();
}
