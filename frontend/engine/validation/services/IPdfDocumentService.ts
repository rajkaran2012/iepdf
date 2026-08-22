/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IPdfDocumentService.ts
 * Module     : Validation Services
 * Layer      : Interface
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the contract for centralized PDF document access.
 *
 * This file MUST contain only the service contract.
 *
 * It MUST NOT:
 *
 * - Import pdfjs-dist at runtime
 * - Open PDF files
 * - Parse PDF files
 * - Contain validation logic
 * - Contain browser implementation details
 * =============================================================================
 */

import type { ParsedPdfDocument } from "../models/ParsedPdfDocument";

import type { PDFDocumentProxy } from "pdfjs-dist";

export interface IPdfDocumentService {

    /**
     * =========================================================================
     * Opens a PDF document.
     * =========================================================================
     */
    open(
        file: File
    ): Promise<void>;

    /**
     * =========================================================================
     * Closes the currently opened PDF document.
     * =========================================================================
     */
    close(): Promise<void>;

    /**
     * =========================================================================
     * Returns true when a PDF document is currently open.
     * =========================================================================
     */
    isOpen(): boolean;

    /**
     * =========================================================================
     * Returns the currently opened PDF.js document.
     * =========================================================================
     */
    getDocument(): PDFDocumentProxy;

    /**
     * =========================================================================
     * Returns whether the currently opened PDF is encrypted.
     * =========================================================================
     */
    isEncrypted(): Promise<boolean>;

    /**
     * =========================================================================
     * Returns the number of pages in the currently opened PDF.
     * =========================================================================
     */
    getPageCount(): Promise<number>;

    /**
     * =========================================================================
     * Returns PDF metadata.
     * =========================================================================
     */
    getMetadata(): Promise<Record<string, unknown>>;

    /**
     * =========================================================================
     * Returns PDF document information.
     * =========================================================================
     */
    getDocumentInfo(): Promise<Record<string, unknown>>;

    /**
     * =========================================================================
     * Returns the parsed PDF document.
     *
     * Reserved for Deep Validation.
     * =========================================================================
     */
    getParsedDocument(): ParsedPdfDocument;

}