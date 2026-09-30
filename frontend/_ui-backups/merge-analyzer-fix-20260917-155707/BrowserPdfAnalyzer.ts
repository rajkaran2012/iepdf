import { PDFDocument } from "pdf-lib";
import { AnalysisResult } from "./AnalysisResult";

export class BrowserPdfAnalyzer {
  async analyze(file: File): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      id: crypto.randomUUID(),

      filename: file.name,
      extension: "pdf",

      size: file.size,
      pages: 0,

      encrypted: false,
      corrupted: false,

      status: "scanning",
    };

    try {
      const bytes = await file.arrayBuffer();

      const pdf = await PDFDocument.load(bytes);

      result.pages = pdf.getPageCount();
      result.status = "ready";

      return result;
    } catch (err: any) {
      const message = String(err?.message ?? err);

      if (
        message.includes("encrypted") ||
        message.includes("ignoreEncryption")
      ) {
        result.encrypted = true;
        result.status = "password_required";

        return result;
      }

      result.corrupted = true;
      result.status = "corrupted";
      result.error = message;

      return result;
    }
  }

  async analyzeMany(files: File[]) {
    return Promise.all(files.map(file => this.analyze(file)));
  }
}