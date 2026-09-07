import { describe, it, expect } from "vitest";
import { PdfiumCompressorAdapter } from "../../engine/compression/PdfiumCompressorAdapter";

describe(
    "PDFium save diagnostic",
    () => {

        it(
            "saves an opened PDF through the EmbedPDF memory writer",
            async () => {

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

                const adapter =
                    new PdfiumCompressorAdapter();

                const documentPtr =
                    await adapter.openDocument(file);

                const module =
                    adapter.getModule();

                console.log(
                    "DOCUMENT PTR:",
                    documentPtr
                );

                console.log(
                    "PAGE COUNT BEFORE SAVE:",
                    module.FPDF_GetPageCount(
                        documentPtr
                    )
                );

                const writerPtr =
                    module.PDFiumExt_OpenFileWriter();

                console.log(
                    "WRITER PTR:",
                    writerPtr
                );

                expect(
                    writerPtr
                ).toBeTruthy();

                try {

                    const saveResult =
                        module.PDFiumExt_SaveAsCopy(
                            documentPtr,
                            writerPtr
                        );

                    console.log(
                        "SAVE RESULT:",
                        saveResult
                    );

                    console.log(
                        "LAST ERROR AFTER SAVE:",
                        module.FPDF_GetLastError()
                    );

                    expect(
                        saveResult
                    ).toBeTruthy();

                    const outputSize =
                        module.PDFiumExt_GetFileWriterSize(
                            writerPtr
                        );

                    console.log(
                        "OUTPUT SIZE:",
                        outputSize
                    );

                    expect(
                        outputSize
                    ).toBeGreaterThan(0);

                    const outputPtr =
                        module.pdfium.wasmExports.malloc(
                            outputSize
                        );

                    console.log(
                        "OUTPUT BUFFER PTR:",
                        outputPtr
                    );

                    expect(
                        outputPtr
                    ).toBeTruthy();

                    try {

                        const copied =
                            module.PDFiumExt_GetFileWriterData(
                                writerPtr,
                                outputPtr,
                                outputSize
                            );

                        console.log(
                            "GET DATA RESULT:",
                            copied
                        );

                        const heap =
                            (
                                module.pdfium as unknown as {
                                    HEAPU8: Uint8Array;
                                }
                            ).HEAPU8;

                        const outputBytes =
                            new Uint8Array(
                                heap.buffer,
                                outputPtr,
                                outputSize
                            ).slice();

                        console.log(
                            "OUTPUT BYTES LENGTH:",
                            outputBytes.length
                        );

                        console.log(
                            "FIRST 16 OUTPUT BYTES:",
                            Array.from(
                                outputBytes.slice(
                                    0,
                                    16
                                )
                            )
                        );

                        const header =
                            new TextDecoder().decode(
                                outputBytes.slice(
                                    0,
                                    5
                                )
                            );

                        console.log(
                            "OUTPUT HEADER:",
                            JSON.stringify(header)
                        );

                        expect(
                            header
                        ).toBe("%PDF-");

                        /*
                         * Re-open the serialized bytes using a
                         * completely new PDFium adapter.
                         */
                        const outputFile =
                            new File(
                                [outputBytes],
                                "saved.pdf",
                                {
                                    type: "application/pdf"
                                }
                            );

                        const verifyAdapter =
                            new PdfiumCompressorAdapter();

                        const verifyDocumentPtr =
                            await verifyAdapter.openDocument(
                                outputFile
                            );

                        const verifyModule =
                            verifyAdapter.getModule();

                        const verifyPageCount =
                            verifyModule.FPDF_GetPageCount(
                                verifyDocumentPtr
                            );

                        console.log(
                            "REOPENED DOCUMENT PTR:",
                            verifyDocumentPtr
                        );

                        console.log(
                            "PAGE COUNT AFTER REOPEN:",
                            verifyPageCount
                        );

                        console.log(
                            "REOPEN LAST ERROR:",
                            verifyModule.FPDF_GetLastError()
                        );

                        expect(
                            verifyPageCount
                        ).toBe(1);

                        await verifyAdapter.closeDocument();

                    } finally {

                        module.pdfium.wasmExports.free(
                            outputPtr
                        );

                    }

                } finally {

                    module.PDFiumExt_CloseFileWriter(
                        writerPtr
                    );

                    await adapter.closeDocument();

                }

            }
        );

    }
);
