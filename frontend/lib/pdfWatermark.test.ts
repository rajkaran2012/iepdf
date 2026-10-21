import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { watermarkPdfFile } from "./pdfWatermark";

describe("watermarkPdfFile", () => {
  it("adds a Free watermark to every PDF page and returns a PDF", async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]);
    source.addPage([595, 842]);
    const bytes = await source.save();
    const file = new File([new Uint8Array(bytes)], "sample.pdf", {
      type: "application/pdf",
    });

    const result = await watermarkPdfFile(file);
    const output = await PDFDocument.load(await result.arrayBuffer());

    expect(result.name).toBe("sample.pdf");
    expect(result.type).toBe("application/pdf");
    expect(output.getPageCount()).toBe(2);
    expect(output.getPages()).toHaveLength(2);
  });

  it("rejects a non-PDF file", async () => {
    const file = new File(["not a PDF"], "sample.txt", {
      type: "text/plain",
    });

    await expect(watermarkPdfFile(file)).rejects.toThrow(
      "Watermarking requires a PDF file.",
    );
  });
});
