"use client";

import {
    DEFAULT_PDFIUM_WASM_URL,
    init,
    type WrappedPdfiumModule,
} from "@embedpdf/pdfium";

export interface RenderedPdfPage {
    readonly width: number;
    readonly height: number;
    readonly stride: number;
    readonly pixels: Uint8Array;
}

export class PdfiumPageRenderer {
    private module: WrappedPdfiumModule | null = null;
    private documentPtr: number | null = null;
    private documentBufferPtr: number | null = null;
    private pagePtr: number | null = null;

    public async initialize(): Promise<void> {
        if (this.module) {
            return;
        }

        this.module = await init({
            locateFile: (filename: string) =>
                filename === "pdfium.wasm"
                    ? DEFAULT_PDFIUM_WASM_URL
                    : filename,
        });

        this.module.PDFiumExt_Init();
    }

    public async openDocument(file: File): Promise<void> {
        await this.initialize();

        const module = this.ensureModule();

        this.closeDocument();

        const bytes = new Uint8Array(
            await file.arrayBuffer()
        );

        const malloc = module.pdfium.wasmExports.malloc;

        const bufferPtr = malloc(bytes.byteLength);

        if (!bufferPtr) {
            throw new Error(
                "Unable to allocate memory for the PDF."
            );
        }

        try {
            const heap = (
                module.pdfium as unknown as {
                    HEAPU8: Uint8Array;
                }
            ).HEAPU8;

            heap.set(bytes, bufferPtr);

            const documentPtr =
                module.FPDF_LoadMemDocument(
                    bufferPtr,
                    bytes.byteLength,
                    ""
                );

            if (!documentPtr) {
                throw new Error(
                    "Unable to open the PDF document."
                );
            }

            this.documentPtr = documentPtr;
            this.documentBufferPtr = bufferPtr;
        } catch (error: unknown) {
            module.pdfium.wasmExports.free(bufferPtr);

            throw error;
        }
    }

    public getPageCount(): number {
        const module = this.ensureModule();
        const documentPtr = this.ensureDocument();

        return module.FPDF_GetPageCount(documentPtr);
    }

    public renderPage(
        pageIndex: number,
        dpi = 150
    ): RenderedPdfPage {
        const module = this.ensureModule();
        const documentPtr = this.ensureDocument();

        this.closePage();

        const pagePtr = module.FPDF_LoadPage(
            documentPtr,
            pageIndex
        );

        if (!pagePtr) {
            throw new Error(
                `Unable to open PDF page ${pageIndex + 1}.`
            );
        }

        this.pagePtr = pagePtr;

        const pageWidth =
            module.FPDF_GetPageWidth(pagePtr);

        const pageHeight =
            module.FPDF_GetPageHeight(pagePtr);

        if (
            !Number.isFinite(pageWidth) ||
            !Number.isFinite(pageHeight) ||
            pageWidth <= 0 ||
            pageHeight <= 0
        ) {
            throw new Error(
                `Invalid dimensions for PDF page ${pageIndex + 1}.`
            );
        }

        const scale = dpi / 72;

        const width = Math.max(
            1,
            Math.ceil(pageWidth * scale)
        );

        const height = Math.max(
            1,
            Math.ceil(pageHeight * scale)
        );

        const bitmapPtr =
            module.FPDFBitmap_Create(
                width,
                height,
                1
            );

        if (!bitmapPtr) {
            throw new Error(
                `Unable to create bitmap for PDF page ${pageIndex + 1}.`
            );
        }

        try {
            module.FPDF_RenderPageBitmap(
                bitmapPtr,
                pagePtr,
                0,
                0,
                width,
                height,
                0,
                0
            );

            const bufferPtr =
                module.FPDFBitmap_GetBuffer(
                    bitmapPtr
                );

            const stride =
                module.FPDFBitmap_GetStride(
                    bitmapPtr
                );

            const bitmapWidth =
                module.FPDFBitmap_GetWidth(
                    bitmapPtr
                );

            const bitmapHeight =
                module.FPDFBitmap_GetHeight(
                    bitmapPtr
                );

            if (
                !bufferPtr ||
                stride <= 0 ||
                bitmapWidth <= 0 ||
                bitmapHeight <= 0
            ) {
                throw new Error(
                    `PDFium returned an invalid bitmap for page ${pageIndex + 1}.`
                );
            }

            const heap = (
                module.pdfium as unknown as {
                    HEAPU8: Uint8Array;
                }
            ).HEAPU8;

            const byteLength =
                stride * bitmapHeight;

            const pixels = new Uint8Array(
                byteLength
            );

            pixels.set(
                heap.subarray(
                    bufferPtr,
                    bufferPtr + byteLength
                )
            );

            return {
                width: bitmapWidth,
                height: bitmapHeight,
                stride,
                pixels,
            };
        } finally {
            module.FPDFBitmap_Destroy(bitmapPtr);
        }
    }

    public closePage(): void {
        if (
            this.module &&
            this.pagePtr !== null
        ) {
            this.module.FPDF_ClosePage(
                this.pagePtr
            );

            this.pagePtr = null;
        }
    }

    public closeDocument(): void {
        if (
            this.module &&
            this.documentPtr !== null
        ) {
            this.closePage();

            this.module.FPDF_CloseDocument(
                this.documentPtr
            );

            this.documentPtr = null;
        }

        if (
            this.module &&
            this.documentBufferPtr !== null
        ) {
            this.module.pdfium.wasmExports.free(
                this.documentBufferPtr
            );

            this.documentBufferPtr = null;
        }
    }

    public destroy(): void {
        this.closeDocument();
        this.module = null;
    }

    private ensureModule(): WrappedPdfiumModule {
        if (!this.module) {
            throw new Error(
                "PDFium renderer has not been initialized."
            );
        }

        return this.module;
    }

    private ensureDocument(): number {
        if (this.documentPtr === null) {
            throw new Error(
                "No PDF document is currently open."
            );
        }

        return this.documentPtr;
    }
}
