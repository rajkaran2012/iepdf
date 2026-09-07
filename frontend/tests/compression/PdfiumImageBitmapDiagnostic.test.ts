import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe("PDFium image bitmap diagnostic", () => {

    it("gets bitmap information from a real image object", async () => {

        const fixture =
            "C:/IEPDF/FRONTEND/tests/fixtures/image-fixture-valid.pdf";

        const bytes =
            await readFile(fixture);

        const file =
            new File(
                [bytes],
                "image-fixture-valid.pdf",
                {
                    type: "application/pdf"
                }
            );

        const adapter =
            new PdfiumCompressorAdapter();

        try {

            console.log("STEP 1: opening document");

            const documentPtr =
                await adapter.openDocument(file);

            const module =
                adapter.getModule();

            console.log(
                "DOCUMENT PTR:",
                documentPtr
            );

            const pageCount =
                module.FPDF_GetPageCount(
                    documentPtr
                );

            console.log(
                "PAGE COUNT:",
                pageCount
            );

            const pagePtr =
                module.FPDF_LoadPage(
                    documentPtr,
                    0
                );

            expect(pagePtr).toBeTruthy();

            console.log(
                "PAGE PTR:",
                pagePtr
            );

            const objectCount =
                module.FPDFPage_CountObjects(
                    pagePtr
                );

            console.log(
                "OBJECT COUNT:",
                objectCount
            );

            expect(objectCount).toBeGreaterThan(0);

            let imageObjectPtr = 0;

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

                const objectType =
                    module.FPDFPageObj_GetType(
                        objectPtr
                    );

                console.log(
                    "OBJECT:",
                    i,
                    "PTR:",
                    objectPtr,
                    "TYPE:",
                    objectType
                );

                if (objectType === 3) {

                    imageObjectPtr =
                        objectPtr;

                    break;

                }

            }

            expect(imageObjectPtr).toBeTruthy();

            console.log(
                "IMAGE OBJECT PTR:",
                imageObjectPtr
            );

            console.log(
                "STEP 2: calling FPDFImageObj_GetBitmap"
            );

            const bitmapPtr =
                module.FPDFImageObj_GetBitmap(
                    imageObjectPtr
                );

            console.log(
                "BITMAP PTR:",
                bitmapPtr
            );

            expect(bitmapPtr).toBeTruthy();

            console.log(
                "STEP 3: reading bitmap metadata"
            );

            const width =
                module.FPDFBitmap_GetWidth(
                    bitmapPtr
                );

            const height =
                module.FPDFBitmap_GetHeight(
                    bitmapPtr
                );

            const stride =
                module.FPDFBitmap_GetStride(
                    bitmapPtr
                );

            const format =
                module.FPDFBitmap_GetFormat(
                    bitmapPtr
                );

            const bufferPtr =
                module.FPDFBitmap_GetBuffer(
                    bitmapPtr
                );

            console.log(
                "BITMAP WIDTH:",
                width
            );

            console.log(
                "BITMAP HEIGHT:",
                height
            );

            console.log(
                "BITMAP STRIDE:",
                stride
            );

            console.log(
                "BITMAP FORMAT:",
                format
            );

            console.log(
                "BITMAP BUFFER PTR:",
                bufferPtr
            );

            expect(width).toBeGreaterThan(0);
            expect(height).toBeGreaterThan(0);
            expect(stride).toBeGreaterThan(0);
            expect(bufferPtr).toBeTruthy();

        } finally {

            try {

                await adapter.closeDocument();

            } catch {

                // diagnostic cleanup only

            }

        }

    });

});
