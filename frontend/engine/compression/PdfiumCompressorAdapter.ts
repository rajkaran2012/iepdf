/**
 * =============================================================================
 * iePDF Compression Engine
 * =============================================================================
 *
 * File       : PdfiumCompressorAdapter.ts
 * Module     : Compression
 * Layer      : PDFium Adapter
 *
 * Current responsibility:
 *     - PDFium initialization
 *     - PDF document lifecycle
 *     - Page object analysis
 *
 * Compression/recompression is intentionally NOT performed here.
 * =============================================================================
 */

import {
    DEFAULT_PDFIUM_WASM_URL,
    init,
} from "@embedpdf/pdfium";

import type {
    WrappedPdfiumModule,
} from "@embedpdf/pdfium";


export interface PdfiumImageAnalysis {

    readonly pageIndex: number;

    readonly objectIndex: number;

    readonly width: number;

    readonly height: number;

    readonly format: number;

    readonly hasBitmap: boolean;

}


export interface PdfiumPageAnalysis {

    readonly pageIndex: number;

    readonly objectCount: number;

    readonly imageCount: number;

    readonly images:
        readonly PdfiumImageAnalysis[];

}


export class PdfiumCompressorAdapter {

    private module:
        WrappedPdfiumModule | null = null;

    private documentPtr:
        number | null = null;

    private documentBufferPtr:
        number | null = null;

    private pagePtr:
        number | null = null;


    /**
     * =========================================================================
     * Initialize PDFium.
     * =========================================================================
     */
    public async initialize(): Promise<void> {

        if (this.module !== null) {

            return;

        }

        if (
            typeof window !== "undefined"
        ) {

            this.module =
                await init({

                    locateFile:
                        (filename: string) => {

                            if (
                                filename ===
                                "pdfium.wasm"
                            ) {

                                return DEFAULT_PDFIUM_WASM_URL;

                            }

                            return filename;

                        },

                });

            this.module.PDFiumExt_Init();

            return;

        }

        const path =
            await import("node:path");

        const fs =
            await import("node:fs/promises");

        const packageEntry =
            require.resolve(
                "@embedpdf/pdfium"
            );

        const packageDirectory =
            path.dirname(
                packageEntry
            );

        const wasmPath =
            path.join(
                packageDirectory,
                "pdfium.wasm"
            );

        const wasmBinary =
            await fs.readFile(
                wasmPath
            );

        this.module =
            await init({

                wasmBinary,

            });

        this.module.PDFiumExt_Init();

    }


    /**
     * =========================================================================
     * Returns the initialized PDFium module.
     * =========================================================================
     */
    public getModule(): WrappedPdfiumModule {

        if (
            this.module === null
        ) {

            throw new Error(
                "PDFium has not been initialized."
            );

        }

        return this.module;

    }


    /**
     * =========================================================================
     * Returns whether PDFium is initialized.
     * =========================================================================
     */
    public isInitialized(): boolean {

        return this.module !== null;

    }


    /**
     * =========================================================================
     * Open a PDF from a browser File.
     * =========================================================================
     */
    public async openDocument(
        file: File
    ): Promise<number> {

        await this.initialize();

        const module =
            this.getModule();

        await this.closeDocument();

        const bytes =
            new Uint8Array(
                await file.arrayBuffer()
            );

        const pointer =
            module.pdfium.wasmExports.malloc(
                bytes.byteLength
            );

        if (
            !pointer
        ) {

            throw new Error(
                "Unable to allocate PDFium memory."
            );

        }

        const heap =
            (
                module.pdfium as unknown as {
                    HEAPU8: Uint8Array;
                }
            ).HEAPU8;

        heap.set(
            bytes,
            pointer
        );

        try {

            const documentPtr =
                module.FPDF_LoadMemDocument(
                    pointer,
                    bytes.byteLength,
                    ""
                );

            if (
                !documentPtr
            ) {

                const errorCode =
                    module.FPDF_GetLastError();

                throw new Error(
                    `PDFium failed to open PDF. Error code: ${errorCode}`
                );

            }

            this.documentPtr =
                documentPtr;

            this.documentBufferPtr =
                pointer;

            return documentPtr;

        } catch (error) {

            module.pdfium.wasmExports.free(
                pointer
            );

            throw error;

        }

    }


    /**
     * =========================================================================
     * Returns the currently opened document.
     * =========================================================================
     */
    public getDocumentPtr(): number {

        if (
            this.documentPtr === null
        ) {

            throw new Error(
                "PDFium document is not open."
            );

        }

        return this.documentPtr;

    }


    /**
     * =========================================================================
     * Returns PDF page count.
     * =========================================================================
     */
    public getPageCount(): number {

        const module =
            this.getModule();

        const documentPtr =
            this.getDocumentPtr();

        return module.FPDF_GetPageCount(
            documentPtr
        );

    }


    /**
     * =========================================================================
     * Open a single page.
     * =========================================================================
     */
    public openPage(
        pageIndex: number
    ): number {

        const module =
            this.getModule();

        const documentPtr =
            this.getDocumentPtr();

        if (
            !Number.isInteger(pageIndex) ||
            pageIndex < 0 ||
            pageIndex >=
                module.FPDF_GetPageCount(
                    documentPtr
                )
        ) {

            throw new Error(
                `Invalid PDF page index: ${pageIndex}`
            );

        }

        this.closePage();

        const pagePtr =
            module.FPDF_LoadPage(
                documentPtr,
                pageIndex
            );

        if (
            !pagePtr
        ) {

            const errorCode =
                module.FPDF_GetLastError();

            throw new Error(
                `PDFium failed to open page ${pageIndex}. Error code: ${errorCode}`
            );

        }

        this.pagePtr =
            pagePtr;

        return pagePtr;

    }


    /**
     * =========================================================================
     * Returns the currently opened page pointer.
     * =========================================================================
     */
    public getPagePtr(): number {

        if (
            this.pagePtr === null
        ) {

            throw new Error(
                "PDFium page is not open."
            );

        }

        return this.pagePtr;

    }


    /**
     * =========================================================================
     * Analyze page objects.
     *
     * This method ONLY inspects the page.
     * It does not modify the PDF.
     * =========================================================================
     */
    public analyzePage(
        pagePtr: number,
        pageIndex: number
    ): PdfiumPageAnalysis {

        const module =
            this.getModule();

        const objectCount =
            module.FPDFPage_CountObjects(
                pagePtr
            );

        const images:
            PdfiumImageAnalysis[] = [];

        for (
            let objectIndex = 0;
            objectIndex < objectCount;
            objectIndex++
        ) {

            const objectPtr =
                module.FPDFPage_GetObject(
                    pagePtr,
                    objectIndex
                );

            if (
                !objectPtr
            ) {

                continue;

            }

            const objectType =
                module.FPDFPageObj_GetType(
                    objectPtr
                );

            /*
             * PDFium FPDF_PAGEOBJ_IMAGE = 3.
             */
            if (
                objectType !== 3
            ) {

                continue;

            }

            const widthPtr =
                module.pdfium.wasmExports.malloc(
                    4
                );

            const heightPtr =
                module.pdfium.wasmExports.malloc(
                    4
                );

            if (
                !widthPtr ||
                !heightPtr
            ) {

                if (widthPtr) {

                    module.pdfium.wasmExports.free(
                        widthPtr
                    );

                }

                if (heightPtr) {

                    module.pdfium.wasmExports.free(
                        heightPtr
                    );

                }

                throw new Error(
                    "Unable to allocate PDFium image dimension memory."
                );

            }

            try {

                const result =
                    module.FPDFImageObj_GetImagePixelSize(
                        objectPtr,
                        widthPtr,
                        heightPtr
                    );

                const heap =
                    (
                        module.pdfium as unknown as {
                            HEAPU32: Uint32Array;
                        }
                    ).HEAPU32;

                const width =
                    result
                        ? heap[
                            widthPtr >>> 2
                        ]
                        : 0;

                const height =
                    result
                        ? heap[
                            heightPtr >>> 2
                        ]
                        : 0;

                const bitmapPtr =
                    module.FPDFImageObj_GetBitmap(
                        objectPtr
                    );

                let format =
                    -1;

                if (
                    bitmapPtr
                ) {

                    format =
                        module.FPDFBitmap_GetFormat(
                            bitmapPtr
                        );

                }

                images.push({

                    pageIndex,

                    objectIndex,

                    width,

                    height,

                    format,

                    hasBitmap:
                        bitmapPtr !== 0,

                });

            } finally {

                module.pdfium.wasmExports.free(
                    widthPtr
                );

                module.pdfium.wasmExports.free(
                    heightPtr
                );

            }

        }

        return {

            pageIndex,

            objectCount,

            imageCount:
                images.length,

            images,

        };

    }


    /**
     * =========================================================================
     * Analyze a page by page index.
     * =========================================================================
     */
    public analyzePageByIndex(
        pageIndex: number
    ): PdfiumPageAnalysis {

        const pagePtr =
            this.openPage(
                pageIndex
            );

        return this.analyzePage(
            pagePtr,
            pageIndex
        );

    }


    /**
     * =========================================================================
     * Close current page.
     * =========================================================================
     */
    public closePage(): void {

        if (
            this.module === null ||
            this.pagePtr === null
        ) {

            this.pagePtr =
                null;

            return;

        }

        this.module.FPDF_ClosePage(
            this.pagePtr
        );

        this.pagePtr =
            null;

    }


    /**
     * =========================================================================
     * Close current document.
     * =========================================================================
     */
    public async closeDocument(): Promise<void> {

        this.closePage();

        if (
            this.module === null ||
            this.documentPtr === null
        ) {

            this.documentPtr =
                null;

            return;

        }

        this.module.FPDF_CloseDocument(
            this.documentPtr
        );

        this.documentPtr =
            null;

    }

}
