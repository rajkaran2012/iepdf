/**
 * =============================================================================
 * iePDF Protected Document Engine
 * =============================================================================
 *
 * File       : PdfiumProtectedPdfDocument.ts
 * Module     : Protected Document
 * Layer      : PDFium Implementation
 *
 * Purpose
 * -------
 * Internal wrapper around the PDFium PdfDocumentObject.
 *
 * IMPORTANT
 * ---------
 * This class is internal to the PDFium implementation.
 *
 * The rest of iePDF must interact through IProtectedPdfDocument.
 * =============================================================================
 */

import type {
    PdfDocumentObject
} from "@embedpdf/models";

import type {
    IProtectedPdfDocument
} from "../interfaces/IProtectedPdfDocument";

export class PdfiumProtectedPdfDocument
    implements IProtectedPdfDocument {

    /**
     * Unique identifier.
     */
    public readonly id: string;

    /**
     * Number of pages.
     */
    public readonly pageCount: number;

    /**
     * Underlying PDFium document.
     *
     * Kept private so PDFium does not leak outside this implementation.
     */
    private readonly pdfiumDocument:
        PdfDocumentObject;

    public constructor(
        id: string,
        pdfiumDocument: PdfDocumentObject
    ) {

        this.id =
            id;

        this.pdfiumDocument =
            pdfiumDocument;

        this.pageCount =
            pdfiumDocument.pageCount;

    }

    /**
     * Returns the internal PDFium document.
     *
     * This method must only be used by the PDFium adapter.
     */
    public getInternalDocument():
        PdfDocumentObject {

        return this.pdfiumDocument;

    }

}