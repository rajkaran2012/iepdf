/**
 * =============================================================================
 * iePDF Protected Document Engine
 * =============================================================================
 *
 * File       : IProtectedPdfDocument.ts
 * Module     : Protected Document
 * Layer      : Interface
 *
 * Purpose
 * -------
 * Represents an opened protected PDF without exposing the underlying
 * PDFium / EmbedPDF implementation.
 *
 * This interface contains NO PDFium types.
 * This interface contains NO UI logic.
 * =============================================================================
 */

export interface IProtectedPdfDocument {

    /**
     * Unique identifier assigned to the opened document.
     */
    readonly id: string;

    /**
     * Total number of pages in the document.
     */
    readonly pageCount: number;

}