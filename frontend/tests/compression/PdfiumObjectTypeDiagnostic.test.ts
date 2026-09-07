import { describe, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe("PDFium object type diagnostic", () => {

    it("checks actual object type and image APIs", async () => {

        const bytes = new Uint8Array(
            await readFile(
                "C:/IEPDF/FRONTEND/tests/fixtures/image-fixture-real.pdf"
            )
        );

        const file = new File(
            [bytes],
            "image-fixture-real.pdf",
            {
                type: "application/pdf"
            }
        );

        const adapter = new PdfiumCompressorAdapter();

        try {

            await adapter.openDocument(file);

            const module = adapter.getModule();

            const pagePtr = adapter.openPage(0);

            console.log("PAGE PTR:", pagePtr);

            const objectCount =
                module.FPDFPage_CountObjects(pagePtr);

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

                console.log("");
                console.log("OBJECT:", i);
                console.log("OBJECT PTR:", objectPtr);

                if (!objectPtr) {
                    continue;
                }

                const type =
                    module.FPDFPageObj_GetType(
                        objectPtr
                    );

                console.log(
                    "OBJECT TYPE:",
                    type
                );

                console.log(
                    "IMAGE PIXEL SIZE FUNCTION AVAILABLE:",
                    typeof module.FPDFImageObj_GetImagePixelSize
                );

                console.log(
                    "GET BITMAP FUNCTION AVAILABLE:",
                    typeof module.FPDFImageObj_GetBitmap
                );

                const widthPtr =
                    module.pdfium.wasmExports.malloc(4);

                const heightPtr =
                    module.pdfium.wasmExports.malloc(4);

                try {

                    console.log(
                        "WIDTH PTR:",
                        widthPtr
                    );

                    console.log(
                        "HEIGHT PTR:",
                        heightPtr
                    );

                    const result =
                        module.FPDFImageObj_GetImagePixelSize(
                            objectPtr,
                            widthPtr,
                            heightPtr
                        );

                    console.log(
                        "IMAGE PIXEL SIZE RESULT:",
                        result
                    );

                    const heap =
                        (
                            module.pdfium as unknown as {
                                HEAPU32: Uint32Array;
                            }
                        ).HEAPU32;

                    console.log(
                        "WIDTH:",
                        result
                            ? heap[widthPtr >>> 2]
                            : 0
                    );

                    console.log(
                        "HEIGHT:",
                        result
                            ? heap[heightPtr >>> 2]
                            : 0
                    );

                    const bitmapPtr =
                        module.FPDFImageObj_GetBitmap(
                            objectPtr
                        );

                    console.log(
                        "IMAGE BITMAP PTR:",
                        bitmapPtr
                    );

                    if (bitmapPtr) {

                        console.log(
                            "BITMAP FORMAT:",
                            module.FPDFBitmap_GetFormat(
                                bitmapPtr
                            )
                        );

                        console.log(
                            "BITMAP WIDTH:",
                            module.FPDFBitmap_GetWidth(
                                bitmapPtr
                            )
                        );

                        console.log(
                            "BITMAP HEIGHT:",
                            module.FPDFBitmap_GetHeight(
                                bitmapPtr
                            )
                        );

                    }

                } finally {

                    module.pdfium.wasmExports.free(
                        widthPtr
                    );

                    module.pdfium.wasmExports.free(
                        heightPtr
                    );

                }

            }

        } finally {

            await adapter.closeDocument();

        }

    });

});
