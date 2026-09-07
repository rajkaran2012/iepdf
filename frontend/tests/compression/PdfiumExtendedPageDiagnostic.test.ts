import { describe, it, expect } from "vitest";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe(
    "PDFium extended page diagnostic",
    () => {

        it(
            "loads page using EmbedPDF object-number API",
            async () => {

                const adapter =
                    new PdfiumCompressorAdapter();

                const fixture =
                    "C:\\IEPDF\\FRONTEND\\tests\\fixtures\\image-fixture-valid.pdf";

                const fs =
                    await import("node:fs/promises");

                const bytes =
                    await fs.readFile(fixture);

                const file =
                    new File(
                        [bytes],
                        "image-fixture-valid.pdf",
                        {
                            type: "application/pdf"
                        }
                    );

                console.log(
                    "STEP 1: opening document"
                );

                await adapter.openDocument(file);

                const module =
                    adapter.getModule();

                const documentPtr =
                    adapter.getDocumentPtr();

                console.log(
                    "STEP 2: document:",
                    documentPtr
                );

                const objectNumber =
                    module.EPDFDoc_GetPageObjectNumberByIndex(
                        documentPtr,
                        0
                    );

                console.log(
                    "STEP 3: object number:",
                    objectNumber
                );

                console.log(
                    "STEP 4: about to load page by object number"
                );

                const pagePtr =
                    module.EPDFDoc_LoadPageByObjectNumber(
                        documentPtr,
                        objectNumber
                    );

                console.log(
                    "STEP 5: page ptr:",
                    pagePtr
                );

                expect(pagePtr).toBeTruthy();

                module.FPDF_ClosePage(
                    pagePtr
                );

                console.log(
                    "STEP 6: page closed"
                );

            }
        );

    }
);
