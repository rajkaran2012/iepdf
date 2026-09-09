/**
 * =============================================================================
 * iePDF Protected Document Engine
 * =============================================================================
 *
 * File       : IProtectedPdfEngine.ts
 * Module     : Protected Document
 * Layer      : Interface
 *
 * Purpose
 * -------
 * Defines the technology-independent contract for opening and managing
 * protected PDF documents.
 *
 * The rest of iePDF must depend on this interface rather than directly
 * depending on PDFium / EmbedPDF.
 *
 * This interface contains:
 * - No PDFium types
 * - No EmbedPDF types
 * - No UI logic
 * - No merge logic
 *
 * =============================================================================
 */

import type {
    IProtectedPdfDocument
} from "./IProtectedPdfDocument";

import type {
    ProtectedPdfOpenResult
} from "../models/ProtectedPdfOpenResult";

import type {
    ProtectedPdfAuthorization
} from "../models/ProtectedPdfAuthorization";


export interface IProtectedPdfEngine {

    /**
     * Opens a PDF document.
     *
     * If the document is protected, the supplied password is used.
     */
    open(
        file: File,
        password?: string
    ): Promise<ProtectedPdfOpenResult>;


    /**
     * Inspects the application-level authorization state of an opened
     * protected PDF.
     *
     * This operation does not modify the document.
     */
    inspectAuthorization(
        document: IProtectedPdfDocument
    ): Promise<ProtectedPdfAuthorization>;


    /**
     * Removes encryption from an opened protected PDF.
     *
     * The operation is permitted only when the document has been
     * authorized for encryption removal.
     *
     * Returns true when encryption is successfully removed.
     */
    removeEncryption(
        document: IProtectedPdfDocument
    ): Promise<boolean>;


    /**
     * Saves an opened document as a new PDF byte stream.
     */
    saveAsCopy(
        document: IProtectedPdfDocument
    ): Promise<ArrayBuffer>;


    /**
     * Closes one opened document.
     */
    close(
        document: IProtectedPdfDocument
    ): Promise<void>;


    /**
     * Releases the underlying PDF engine.
     */
    destroy(): Promise<void>;

}