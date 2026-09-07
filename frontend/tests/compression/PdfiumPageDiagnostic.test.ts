import { describe, it, expect } from "vitest";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe("PDFium page diagnostic", () => {

    it("checks page state without rendering", async () => {

        const adapter =
            new PdfiumCompressorAdapter();

        const fixturePath =
            "C:\\IEPDF\\FRONTEND\\tests\\fixtures\\image-fixture-valid.pdf";

        const fs =
            await import("node:fs/promises");

        const bytes =
            await fs.readFile(fixturePath);

        const file =
            new File(
                [bytes],
                "image-fixture-valid.pdf",
                {
                    type: "application/pdf"
                }
            );

        await adapter.openDocument(file);

        const module =
            adapter.getModule();

        const documentPtr =
            adapter.getDocumentPtr();

        console.log(
            "DOCUMENT PTR:",
            documentPtr
        );

        console.log(
            "PAGE COUNT:",
            module.FPDF_GetPageCount(
                documentPtr
            )
        );

        const pagePtr =
            adapter.openPage(0);

        console.log(
            "PAGE PTR:",
            pagePtr
        );

        console.log(
            "PAGE WIDTH:",
            module.FPDF_GetPageWidth(
                pagePtr
            )
        );

        console.log(
            "PAGE HEIGHT:",
            module.FPDF_GetPageHeight(
                pagePtr
            )
        );

        console.log(
            "OBJECT COUNT:",
            module.FPDFPage_CountObjects(
                pagePtr
            )
        );

        console.log(
            "LAST ERROR:",
            module.FPDF_GetLastError()
        );

        expect(pagePtr).toBeGreaterThan(0);

        expect(
            module.FPDF_GetPageWidth(pagePtr)
        ).toBeGreaterThan(0);

        expect(
            module.FPDF_GetPageHeight(pagePtr)
        ).toBeGreaterThan(0);
    });

});
