import { readFileSync, existsSync } from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

export async function loadDataFile(relativePath: string): Promise<string> {
  const basePath = path.join(process.cwd(), "data", relativePath);

  // Try exact path first (e.g. .md file)
  if (existsSync(basePath)) {
    return readFileSync(basePath, "utf-8");
  }

  // Try .pdf variant (e.g. 30-1.pdf instead of 30-1.md)
  const pdfPath = basePath.replace(/\.md$/, ".pdf");
  if (existsSync(pdfPath)) {
    const buffer = readFileSync(pdfPath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }

  // Try .txt variant
  const txtPath = basePath.replace(/\.md$/, ".txt");
  if (existsSync(txtPath)) {
    return readFileSync(txtPath, "utf-8");
  }

  throw new Error(`Data file not found: ${relativePath}`);
}
