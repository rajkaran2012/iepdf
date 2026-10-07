import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
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
      const extension =
        file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

      if (extension !== ".pdf") {
        result.status = "invalid";
        result.error = "Only PDF files are allowed.";
        return result;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());

      const { getDocument, GlobalWorkerOptions, version } =
        await import("pdfjs-dist/legacy/build/pdf.mjs");

      if (typeof window !== "undefined") {
        GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
      }

      let loadingTask: PDFDocumentLoadingTask | null = null;
      let pdf: PDFDocumentProxy | null = null;

      try {
        loadingTask = getDocument({ data: bytes });
        pdf = await loadingTask.promise;

        result.pages = pdf.numPages;
        result.status = "ready";
        return result;
      } catch (error: unknown) {
        const errorName =
          typeof error === "object" &&
          error !== null &&
          "name" in error
            ? String((error as { name?: unknown }).name)
            : "";

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        if (errorName === "PasswordException") {
          result.encrypted = true;
          result.status = "password_required";
          result.error = "Password is required to open this PDF.";
          return result;
        }

        result.corrupted = true;
        result.status = "corrupted";
        result.error = message;

        return result;
      } finally {
        if (pdf) {
          try {
            await pdf.destroy();
          } catch {
            // Ignore PDF.js cleanup errors.
          }
        } else if (loadingTask) {
          try {
            await loadingTask.destroy();
          } catch {
            // Ignore PDF.js cleanup errors.
          }
        }
      }
    } catch (error: unknown) {
      result.corrupted = true;
      result.status = "corrupted";
      result.error =
        error instanceof Error
          ? error.message
          : String(error);

      return result;
    }
  }

  async analyzeMany(files: File[]) {
    return Promise.all(files.map((file) => this.analyze(file)));
  }
}
