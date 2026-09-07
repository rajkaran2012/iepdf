import {
    init,
} from "@embedpdf/pdfium";

import type {
    WrappedPdfiumModule,
} from "@embedpdf/pdfium";


export async function createPdfiumFixture(): Promise<File> {

    const module: WrappedPdfiumModule =
        await init({

            wasmBinary:
                await (
                    await import(
                        "node:fs/promises"
                    )
                ).readFile(
                    require.resolve(
                        "@embedpdf/pdfium"
                    ).replace(
                        /index\.(js|cjs)$/,
                        "pdfium.wasm"
                    )
                ),

        });

    const documentPtr =
        module.FPDF_CreateNewDocument();

    if (!documentPtr) {

        throw new Error(
            "Unable to create PDFium fixture document."
        );

    }

    try {

        const pagePtr =
            module.FPDFPage_New(
                documentPtr,
                0,
                612,
                792
            );

        if (!pagePtr) {

            throw new Error(
                "Unable to create PDFium fixture page."
            );

        }

        try {

            const writerPtr =
                module.PDFiumExt_OpenFileWriter();

            if (!writerPtr) {

                throw new Error(
                    "Unable to create PDFium fixture writer."
                );

            }

            try {

                const saved =
                    module.FPDF_SaveAsCopy(
                        documentPtr,
                        writerPtr,
                        0
                    );

                if (!saved) {

                    throw new Error(
                        "Unable to save PDFium fixture."
                    );

                }

                const size =
                    module.PDFiumExt_GetFileWriterSize(
                        writerPtr
                    );

                const dataPtr =
                    module.PDFiumExt_GetFileWriterData(
                        writerPtr,
                        0,
                        size
                    );

                if (
                    !dataPtr ||
                    size <= 0
                ) {

                    throw new Error(
                        "PDFium fixture writer returned no data."
                    );

                }

                const heap =
                    (
                        module.pdfium as unknown as {
                            HEAPU8: Uint8Array;
                        }
                    ).HEAPU8;

                const bytes =
                    heap.slice(
                        dataPtr,
                        dataPtr + size
                    );

                return new File(
                    [
                        bytes,
                    ],
                    "pdfium-fixture.pdf",
                    {
                        type:
                            "application/pdf",
                    }
                );

            } finally {

                /*
                 * The custom writer is owned by the PDFium extension.
                 * There is no public writer-destroy export in the inspected
                 * declarations, so do not invent one here.
                 */

            }

        } finally {

            module.FPDF_ClosePage(
                pagePtr
            );

        }

    } finally {

        module.FPDF_CloseDocument(
            documentPtr
        );

    }

}
