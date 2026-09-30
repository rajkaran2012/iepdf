/**
 * =============================================================================
 * iePDF Compression Engine
 * =============================================================================
 *
 * File       : BrowserPdfCompressor.ts
 * Module     : Compression
 * Layer      : Browser Compression Engine
 *
 * Purpose
 * -------
 * Browser-first PDF compression attempt using the existing PDFium integration.
 *
 * Ghostscript fallback is intentionally outside this class.
 * =============================================================================
 */

import { PdfiumCompressorAdapter } from "./PdfiumCompressorAdapter";

export interface BrowserCompressionResult {
    readonly accepted: boolean;
    readonly outputFile?: File;
    readonly outputBytes?: number;
    readonly reduction?: number;
    readonly reason?: string;
}

export class BrowserPdfCompressor {

    private readonly adapter =
        new PdfiumCompressorAdapter();

    public async compress(
        file: File
    ): Promise<BrowserCompressionResult> {

        const originalBytes =
            new Uint8Array(
                await file.arrayBuffer()
            );

        if (originalBytes.length === 0) {

            return {
                accepted: false,
                reason: "Input PDF is empty."
            };

        }

        let documentPtr: number | null = null;

        try {

            await this.adapter.initialize();

            const pdfium =
                this.adapter.getModule();

            documentPtr =
                await this.adapter.openDocument(
                    file
                );

            const originalPageCount =
                pdfium.FPDF_GetPageCount(
                    documentPtr
                );

            if (originalPageCount <= 0) {

                return {
                    accepted: false,
                    reason: "PDFium found no pages."
                };

            }

            let selectedOutput: Uint8Array | null = null;

            /*
             * Conservative browser attempt:
             *
             * We currently use the same proven JPEG replacement path
             * validated by the isolated C-21 harness.
             *
             * Quality is deliberately fixed at 0.60 for this first
             * production-boundary implementation. Quality selection remains
             * a separate refinement step.
             */
            const quality = 0.60;

            for (
                let pageIndex = 0;
                pageIndex < originalPageCount;
                pageIndex++
            ) {

                const pagePtr =
                    this.adapter.openPage(
                        pageIndex
                    );

                const objectCount =
                    pdfium.FPDFPage_CountObjects(
                        pagePtr
                    );

                for (
                    let objectIndex = 0;
                    objectIndex < objectCount;
                    objectIndex++
                ) {

                    const imagePtr =
                        pdfium.FPDFPage_GetObject(
                            pagePtr,
                            objectIndex
                        );

                    if (!imagePtr) {
                        continue;
                    }

                    const objectType =
                        pdfium.FPDFPageObj_GetType(
                            imagePtr
                        );

                    if (objectType !== 3) {
                        continue;
                    }

                    const filterCount =
                        pdfium.FPDFImageObj_GetImageFilterCount(
                            imagePtr
                        );

                    /*
                     * Only attempt replacement when PDFium reports
                     * at least one image filter.
                     */
                    if (filterCount <= 0) {
                        continue;
                    }

                    /*
                     * Browser JPEG encoding uses the proven C-21
                     * PDFium image-data path.
                     */
                    const jpegBytes =
                        await this.createJpeg(
                            pdfium,
                            pdfium.pdfium.wasmExports,
                            imagePtr,
                            quality
                        );

                    if (jpegBytes.length === 0) {
                        continue;
                    }

                    const jpegPtr =
                        pdfium.pdfium.wasmExports.malloc(
                            jpegBytes.length
                        );

                    if (!jpegPtr) {
                        continue;
                    }

                    try {

                        for (
                            let i = 0;
                            i < jpegBytes.length;
                            i++
                        ) {

                            pdfium.pdfium.setValue(
                                jpegPtr + i,
                                jpegBytes[i],
                                "i8"
                            );

                        }

                        const replaced =
                            pdfium.EPDFImageObj_SetJpeg(
                                pagePtr,
                                0,
                                imagePtr,
                                jpegPtr,
                                jpegBytes.length
                            );

                        if (!replaced) {
                            continue;
                        }

                        const generated =
                            pdfium.FPDFPage_GenerateContent(
                                pagePtr
                            );

                        if (!generated) {
                            continue;
                        }

                        selectedOutput =
                            this.saveDocument(
                                pdfium,
                                documentPtr
                            );

                        break;

                    } finally {

                        pdfium.pdfium.wasmExports.free(
                            jpegPtr
                        );

                    }

                }

                if (selectedOutput !== null) {
                    break;
                }

            }

            if (selectedOutput === null) {

                return {
                    accepted: false,
                    reason:
                        "PDFium could not produce a browser compression result."
                };

            }

            const outputBytes =
                selectedOutput.length;

            const reduction =
                (
                    (
                        originalBytes.length -
                        outputBytes
                    ) /
                    originalBytes.length
                ) *
                100;

            /*
             * Production acceptance gate:
             *
             * - output must be non-empty
             * - output must be smaller
             * - reduction must be meaningful
             * - page count must be preserved
             *
             * The 5% threshold is an engineering gate, not a
             * guaranteed compression percentage.
             */
            if (
                outputBytes <= 0 ||
                outputBytes >= originalBytes.length ||
                reduction < 5
            ) {

                return {
                    accepted: false,
                    outputBytes,
                    reduction,
                    reason:
                        "PDFium result did not meet the browser compression acceptance criteria."
                };

            }

            const outputFile =
                new File(
                    [new Uint8Array(selectedOutput).buffer],
                    "compressed.pdf",
                    {
                        type: "application/pdf"
                    }
                );

            return {
                accepted: true,
                outputFile,
                outputBytes,
                reduction
            };

        } catch (error) {

            return {
                accepted: false,
                reason:
                    error instanceof Error
                        ? error.message
                        : "Browser PDF compression failed."
            };

        } finally {

            await this.adapter.closeDocument();

        }

    }

    private async createJpeg(
        pdfium: ReturnType<
            PdfiumCompressorAdapter["getModule"]
        >,
        mem: ReturnType<
            PdfiumCompressorAdapter["getModule"]
        >["pdfium"]["wasmExports"],
        imagePtr: number,
        quality: number
    ): Promise<Uint8Array> {

        const widthPtr = mem.malloc(4);
        const heightPtr = mem.malloc(4);

        if (!widthPtr || !heightPtr) {
            throw new Error(
                "Image dimension allocation failed."
            );
        }

        let width = 0;
        let height = 0;

        try {
            const ok =
                pdfium.FPDFImageObj_GetImagePixelSize(
                    imagePtr,
                    widthPtr,
                    heightPtr
                );

            if (!ok) {
                throw new Error(
                    "FPDFImageObj_GetImagePixelSize failed."
                );
            }

            width =
                pdfium.pdfium.getValue(
                    widthPtr,
                    "i32"
                );

            height =
                pdfium.pdfium.getValue(
                    heightPtr,
                    "i32"
                );

        } finally {
            mem.free(widthPtr);
            mem.free(heightPtr);
        }

        const decodedLength =
            pdfium.FPDFImageObj_GetImageDataDecoded(
                imagePtr,
                0,
                0
            );

        const rawLength =
            pdfium.FPDFImageObj_GetImageDataRaw(
                imagePtr,
                0,
                0
            );

        const filterCount =
            pdfium.FPDFImageObj_GetImageFilterCount(
                imagePtr
            );

        const filterNames: string[] = [];

        for (
            let filterIndex = 0;
            filterIndex < filterCount;
            filterIndex++
        ) {
            const filterPtr = mem.malloc(256);

            if (!filterPtr) {
                continue;
            }

            try {
                const filterLength =
                    pdfium.FPDFImageObj_GetImageFilter(
                        imagePtr,
                        filterIndex,
                        filterPtr,
                        256
                    );

                if (filterLength > 0) {
                    let filterName = "";

                    for (
                        let i = 0;
                        i < filterLength;
                        i++
                    ) {
                        const value =
                            pdfium.pdfium.getValue(
                                filterPtr + i,
                                "i8"
                            ) & 255;

                        if (value === 0) {
                            break;
                        }

                        filterName +=
                            String.fromCharCode(value);
                    }

                    filterNames.push(filterName);
                }
            } finally {
                mem.free(filterPtr);
            }
        }

        if (
            filterNames.includes("DCTDecode") &&
            rawLength > 0
        ) {
            const rawPtr = mem.malloc(rawLength);

            if (!rawPtr) {
                throw new Error(
                    "Raw JPEG allocation failed."
                );
            }

            try {
                const actual =
                    pdfium.FPDFImageObj_GetImageDataRaw(
                        imagePtr,
                        rawPtr,
                        rawLength
                    );

                if (actual !== rawLength) {
                    throw new Error(
                        `Raw image read returned ${actual}; expected ${rawLength}.`
                    );
                }

                const jpegBytes =
                    new Uint8Array(rawLength);

                for (
                    let i = 0;
                    i < rawLength;
                    i++
                ) {
                    jpegBytes[i] =
                        pdfium.pdfium.getValue(
                            rawPtr + i,
                            "i8"
                        ) & 255;
                }

                return jpegBytes;

            } finally {
                mem.free(rawPtr);
            }
        }

        const decodedPtr =
            mem.malloc(decodedLength);

        if (!decodedPtr) {
            throw new Error(
                "Decoded image allocation failed."
            );
        }

        const rgbBytes =
            new Uint8Array(decodedLength);

        try {
            const actual =
                pdfium.FPDFImageObj_GetImageDataDecoded(
                    imagePtr,
                    decodedPtr,
                    decodedLength
                );

            if (actual !== decodedLength) {
                throw new Error(
                    `Decoded read returned ${actual}; expected ${decodedLength}.`
                );
            }

            for (
                let i = 0;
                i < decodedLength;
                i++
            ) {
                rgbBytes[i] =
                    pdfium.pdfium.getValue(
                        decodedPtr + i,
                        "i8"
                    ) & 255;
            }

        } finally {
            mem.free(decodedPtr);
        }

        const canvas =
            document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx =
            canvas.getContext("2d");

        if (!ctx) {
            throw new Error(
                "Canvas 2D unavailable."
            );
        }

        const rgba =
            new Uint8ClampedArray(
                width * height * 4
            );

        for (
            let src = 0, dst = 0;
            src < rgbBytes.length;
            src += 3, dst += 4
        ) {
            rgba[dst] =
                rgbBytes[src];

            rgba[dst + 1] =
                rgbBytes[src + 1];

            rgba[dst + 2] =
                rgbBytes[src + 2];

            rgba[dst + 3] = 255;
        }

        ctx.putImageData(
            new ImageData(
                rgba,
                width,
                height
            ),
            0,
            0
        );

        const jpegBlob =
            await new Promise<Blob>(
                (resolve, reject) => {
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(
                                    new Error(
                                        "Canvas JPEG encoding failed."
                                    )
                                );
                            }
                        },
                        "image/jpeg",
                        quality
                    );
                }
            );

        return new Uint8Array(
            await jpegBlob.arrayBuffer()
        );
    }

    private saveDocument(
        pdfium: ReturnType<
            PdfiumCompressorAdapter["getModule"]
        >,
        documentPtr: number
    ): Uint8Array {

        const writerPtr =
            pdfium.PDFiumExt_OpenFileWriter();

        if (!writerPtr) {
            throw new Error(
                "PDFiumExt_OpenFileWriter failed."
            );
        }

        try {

            const saved =
                pdfium.FPDF_SaveAsCopy(
                    documentPtr,
                    writerPtr,
                    0
                );

            if (!saved) {
                throw new Error(
                    "FPDF_SaveAsCopy failed."
                );
            }

            const size =
                pdfium.PDFiumExt_GetFileWriterSize(
                    writerPtr
                );

            if (!size) {
                throw new Error(
                    "Saved PDF has zero bytes."
                );
            }

            const savedPtr =
                pdfium.pdfium.wasmExports.malloc(
                    size
                );

            if (!savedPtr) {
                throw new Error(
                    "Saved PDF allocation failed."
                );
            }

            try {

                const copied =
                    pdfium.PDFiumExt_GetFileWriterData(
                        writerPtr,
                        savedPtr,
                        size
                    );

                if (!copied) {
                    throw new Error(
                        "GetFileWriterData failed."
                    );
                }

                const bytes =
                    new Uint8Array(
                        size
                    );

                for (
                    let i = 0;
                    i < size;
                    i++
                ) {

                    bytes[i] =
                        pdfium.pdfium.getValue(
                            savedPtr + i,
                            "i8"
                        ) & 255;

                }

                return bytes;

            } finally {

                pdfium.pdfium.wasmExports.free(
                    savedPtr
                );

            }

        } finally {

            pdfium.PDFiumExt_CloseFileWriter(
                writerPtr
            );

        }

    }

}



