import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe("PDFium image buffer diagnostic", () => {

    it("reads the bitmap buffer safely", async () => {

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

            const documentPtr =
                await adapter.openDocument(file);

            const module =
                adapter.getModule();

            const pagePtr =
                module.FPDF_LoadPage(
                    documentPtr,
                    0
                );

            expect(pagePtr).toBeTruthy();

            const objectCount =
                module.FPDFPage_CountObjects(
                    pagePtr
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

                if (objectType === 3) {

                    imageObjectPtr =
                        objectPtr;

                    break;

                }

            }

            expect(imageObjectPtr).toBeTruthy();

            const bitmapPtr =
                module.FPDFImageObj_GetBitmap(
                    imageObjectPtr
                );

            expect(bitmapPtr).toBeTruthy();

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

            console.log("WIDTH:", width);
            console.log("HEIGHT:", height);
            console.log("STRIDE:", stride);
            console.log("FORMAT:", format);
            console.log("BUFFER PTR:", bufferPtr);

            expect(width).toBeGreaterThan(0);
            expect(height).toBeGreaterThan(0);
            expect(stride).toBeGreaterThan(0);
            expect(bufferPtr).toBeTruthy();

            const totalBytes =
                stride * height;

            console.log(
                "EXPECTED BUFFER BYTES:",
                totalBytes
            );

            const heap =
                (
                    module.pdfium as unknown as {
                        HEAPU8: Uint8Array;
                    }
                ).HEAPU8;

            console.log(
                "HEAP LENGTH:",
                heap.length
            );

            expect(
                bufferPtr + totalBytes
            ).toBeLessThanOrEqual(
                heap.length
            );

            const pixels =
                heap.slice(
                    bufferPtr,
                    bufferPtr + totalBytes
                );

            console.log(
                "PIXEL BUFFER LENGTH:",
                pixels.length
            );

            console.log(
                "FIRST 32 BYTES:",
                Array.from(
                    pixels.slice(0, 32)
                )
            );

            const nonZeroBytes =
                pixels.reduce(
                    (count, value) =>
                        count + (
                            value !== 0
                                ? 1
                                : 0
                        ),
                    0
                );

            console.log(
                "NON-ZERO BYTE COUNT:",
                nonZeroBytes
            );

            expect(
                pixels.length
            ).toBe(
                totalBytes
            );

            expect(
                nonZeroBytes
            ).toBeGreaterThan(0);

        } finally {

            try {

                await adapter.closeDocument();

            } catch {

                // diagnostic cleanup only

            }

        }

    });

});
