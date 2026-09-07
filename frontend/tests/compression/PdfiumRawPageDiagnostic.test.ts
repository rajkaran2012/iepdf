import { describe, it, expect } from "vitest";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe(
    "Raw PDFium exact failure diagnostic",
    () => {

        it(
            "identifies exact PDFium failure point",
            async () => {

                console.log("STEP 1: create adapter");

                const adapter =
                    new PdfiumCompressorAdapter();

                console.log("STEP 2: read PDF");

                const fs =
                    await import("node:fs/promises");

                const buffer =
                    await fs.readFile(
                        "C:/IEPDF/FRONTEND/tests/fixtures/image-fixture-valid.pdf"
                    );

                console.log(
                    "STEP 3: PDF bytes:",
                    buffer.length
                );

                const file =
                    new File(
                        [buffer],
                        "image-fixture-valid.pdf",
                        {
                            type: "application/pdf"
                        }
                    );

                console.log("STEP 4: openDocument");

                await adapter.openDocument(
                    file
                );

                console.log("STEP 5: openDocument returned");

                console.log("STEP 6: getModule");

                const module =
                    adapter.getModule();

                console.log("STEP 7: getModule returned");

                console.log("STEP 8: getDocumentPtr");

                const documentPtr =
                    adapter.getDocumentPtr();

                console.log(
                    "STEP 9: DOCUMENT PTR:",
                    documentPtr
                );

                expect(
                    documentPtr
                ).toBeGreaterThan(0);

                console.log("STEP 10: FPDF_GetPageCount");

                const pageCount =
                    module.FPDF_GetPageCount(
                        documentPtr
                    );

                console.log(
                    "STEP 11: PAGE COUNT:",
                    pageCount
                );

                expect(
                    pageCount
                ).toBe(1);

                console.log("STEP 12: raw FPDF_LoadPage");

                const pagePtr =
                    module.FPDF_LoadPage(
                        documentPtr,
                        0
                    );

                console.log(
                    "STEP 13: PAGE PTR:",
                    pagePtr
                );

                expect(
                    pagePtr
                ).toBeGreaterThan(0);

                console.log("STEP 14: page loaded");

                module.FPDF_ClosePage(
                    pagePtr
                );

                console.log("STEP 15: page closed");

                await adapter.closeDocument();

                console.log("STEP 16: document closed");

            }
        );

    }
);
