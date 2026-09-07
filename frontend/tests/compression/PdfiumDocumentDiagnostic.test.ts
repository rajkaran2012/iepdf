import { describe, it, expect } from "vitest";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe(
    "PDFium document diagnostic",
    () => {

        it(
            "opens fixture and reports document state",
            async () => {

                console.log("STEP 1: create adapter");

                const adapter =
                    new PdfiumCompressorAdapter();

                console.log("STEP 2: load fixture");

                const fixture =
                    "C:\\IEPDF\\FRONTEND\\tests\\fixtures\\image-fixture-valid.pdf";

                const file =
                    new File(
                        [await import("node:fs/promises").then(
                            fs => fs.readFile(fixture)
                        )],
                        "image-fixture-valid.pdf",
                        {
                            type: "application/pdf"
                        }
                    );

                console.log(
                    "STEP 3: file size:",
                    file.size
                );

                console.log("STEP 4: openDocument");

                await adapter.openDocument(file);

                console.log(
                    "STEP 5: document opened"
                );

                const module =
                    adapter.getModule();

                console.log(
                    "STEP 6: module available"
                );

                console.log(
                    "STEP 7: FPDF_GetLastError:",
                    module.FPDF_GetLastError()
                );

                console.log(
                    "STEP 8: document test complete"
                );

                expect(true).toBe(true);

            }
        );

    }
);
