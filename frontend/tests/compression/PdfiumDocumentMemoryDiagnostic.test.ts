import { describe, it, expect } from "vitest";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe(
    "PDFium document diagnostic",
    () => {

        it(
            "checks document without loading a page",
            async () => {

                const adapter =
                    new PdfiumCompressorAdapter();

                const fixture =
                    "C:\\IEPDF\\FRONTEND\\tests\\fixtures\\image-fixture-valid.pdf";

                const file =
                    new File(
                        [
                            await import("node:fs/promises").then(
                                fs => fs.readFile(fixture)
                            )
                        ],
                        "image-fixture-valid.pdf",
                        {
                            type: "application/pdf"
                        }
                    );

                console.log(
                    "FILE SIZE:",
                    file.size
                );

                const documentPtr =
                    await adapter.openDocument(file);

                console.log(
                    "DOCUMENT PTR:",
                    documentPtr
                );

                const module =
                    adapter.getModule();

                const pageCount =
                    module.FPDF_GetPageCount(
                        documentPtr
                    );

                console.log(
                    "PAGE COUNT:",
                    pageCount
                );

                console.log(
                    "LAST ERROR:",
                    module.FPDF_GetLastError()
                );

                expect(
                    documentPtr
                ).toBeTruthy();

                expect(
                    pageCount
                ).toBe(1);

            }
        );

    }
);
