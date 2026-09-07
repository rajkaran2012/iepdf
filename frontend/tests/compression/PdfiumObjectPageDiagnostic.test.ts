import { describe, it, expect } from "vitest";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe(
    "PDFium object-page diagnostic",
    () => {

        it(
            "gets page object number without loading page",
            async () => {

                console.log("STEP 1: create adapter");

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
                    "STEP 2: file size:",
                    file.size
                );

                await adapter.openDocument(file);

                console.log(
                    "STEP 3: document opened"
                );

                const module =
                    adapter.getModule();

                const documentPtr =
                    adapter.getDocumentPtr();

                console.log(
                    "STEP 4: document ptr:",
                    documentPtr
                );

                console.log(
                    "STEP 5: page count:",
                    module.FPDF_GetPageCount(
                        documentPtr
                    )
                );

                console.log(
                    "STEP 6: about to get object number"
                );

                const objectNumber =
                    module.EPDFDoc_GetPageObjectNumberByIndex(
                        documentPtr,
                        0
                    );

                console.log(
                    "STEP 7: object number:",
                    objectNumber
                );

                expect(objectNumber).toBeGreaterThan(0);

            }
        );

    }
);
