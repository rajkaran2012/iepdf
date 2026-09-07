import { describe, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

const files = [
    "basic.pdf",
    "image-fixture-normalized.pdf",
    "image-fixture-real.pdf",
    "image-fixture-rebuilt.pdf",
    "image-fixture-valid.pdf",
    "image-fixture.pdf",
    "pdfium-render-blank.pdf",
];

describe("PDFium all fixture object types", () => {

    it("maps every page object type", async () => {

        for (const name of files) {

            console.log("");
            console.log("================================");
            console.log("FIXTURE:", name);
            console.log("================================");

            const bytes =
                new Uint8Array(
                    await readFile(
                        `C:/IEPDF/FRONTEND/tests/fixtures/${name}`
                    )
                );

            const file =
                new File(
                    [bytes],
                    name,
                    {
                        type: "application/pdf"
                    }
                );

            const adapter =
                new PdfiumCompressorAdapter();

            try {

                await adapter.openDocument(file);

                const module =
                    adapter.getModule();

                const pagePtr =
                    adapter.openPage(0);

                const objectCount =
                    module.FPDFPage_CountObjects(
                        pagePtr
                    );

                console.log(
                    "OBJECT COUNT:",
                    objectCount
                );

                for (
                    let i = 0;
                    i < objectCount;
                    i++
                ) {

                    const objectPtr =
                        module.FPDFPage_GetObject(
                            pagePtr,
                            i
                        );

                    const type =
                        objectPtr
                            ? module.FPDFPageObj_GetType(
                                objectPtr
                            )
                            : -1;

                    console.log(
                        `OBJECT ${i}:`,
                        {
                            objectPtr,
                            type
                        }
                    );

                }

            } finally {

                await adapter.closeDocument();

            }

        }

    });

});
