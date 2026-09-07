import { describe, it, expect } from "vitest";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe(
    "PDFium image SetBitmap diagnostic",
    () => {

        it(
            "tests replacing an image bitmap without generating a PDF",
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

                const documentPtr =
                    await adapter.openDocument(file);

                const module =
                    adapter.getModule();

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

                const objectCount =
                    module.FPDFPage_CountObjects(
                        pagePtr
                    );

                console.log(
                    "OBJECT COUNT:",
                    objectCount
                );

                const imageObjectPtr =
                    module.FPDFPage_GetObject(
                        pagePtr,
                        0
                    );

                console.log(
                    "IMAGE OBJECT PTR:",
                    imageObjectPtr
                );

                const objectType =
                    module.FPDFPageObj_GetType(
                        imageObjectPtr
                    );

                console.log(
                    "OBJECT TYPE:",
                    objectType
                );

                expect(
                    objectType
                ).toBe(3);

                const oldBitmapPtr =
                    module.FPDFImageObj_GetBitmap(
                        imageObjectPtr
                    );

                console.log(
                    "OLD BITMAP PTR:",
                    oldBitmapPtr
                );

                const width =
                    module.FPDFBitmap_GetWidth(
                        oldBitmapPtr
                    );

                const height =
                    module.FPDFBitmap_GetHeight(
                        oldBitmapPtr
                    );

                const stride =
                    module.FPDFBitmap_GetStride(
                        oldBitmapPtr
                    );

                const format =
                    module.FPDFBitmap_GetFormat(
                        oldBitmapPtr
                    );

                console.log(
                    "WIDTH:",
                    width
                );

                console.log(
                    "HEIGHT:",
                    height
                );

                console.log(
                    "STRIDE:",
                    stride
                );

                console.log(
                    "FORMAT:",
                    format
                );

                const oldBufferPtr =
                    module.FPDFBitmap_GetBuffer(
                        oldBitmapPtr
                    );

                console.log(
                    "OLD BUFFER PTR:",
                    oldBufferPtr
                );

                const heap =
                    (
                        module.pdfium as unknown as {
                            HEAPU8: Uint8Array;
                        }
                    ).HEAPU8;

                const pixelBytes =
                    new Uint8Array(
                        heap.buffer,
                        oldBufferPtr,
                        stride * height
                    );

                const newBitmapPtr =
                    module.FPDFBitmap_CreateEx(
                        width,
                        height,
                        format,
                        0,
                        stride
                    );

                console.log(
                    "NEW BITMAP PTR:",
                    newBitmapPtr
                );

                expect(
                    newBitmapPtr
                ).toBeTruthy();

                const newBufferPtr =
                    module.FPDFBitmap_GetBuffer(
                        newBitmapPtr
                    );

                console.log(
                    "NEW BUFFER PTR:",
                    newBufferPtr
                );

                const newPixelBytes =
                    new Uint8Array(
                        heap.buffer,
                        newBufferPtr,
                        stride * height
                    );

                newPixelBytes.set(
                    pixelBytes
                );

                console.log(
                    "PIXELS COPIED:",
                    newPixelBytes.length
                );

                const beforeError =
                    module.FPDF_GetLastError();

                console.log(
                    "LAST ERROR BEFORE SETBITMAP:",
                    beforeError
                );

                const result =
                    module.FPDFImageObj_SetBitmap(
                        0,
                        0,
                        imageObjectPtr,
                        newBitmapPtr
                    );

                console.log(
                    "SETBITMAP RESULT:",
                    result
                );

                const afterError =
                    module.FPDF_GetLastError();

                console.log(
                    "LAST ERROR AFTER SETBITMAP:",
                    afterError
                );

                module.FPDFBitmap_Destroy(
                    newBitmapPtr
                );

                console.log(
                    "TEMP BITMAP DESTROYED"
                );

                expect(
                    result
                ).toBe(true);

            }
        );

    }
);
