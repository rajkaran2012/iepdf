/**
 * =============================================================================
 * iePDF Protected Document Engine
 * =============================================================================
 *
 * File       : ProtectedPdfOpenResult.ts
 * Module     : Protected Document
 * Layer      : Model
 *
 * Purpose
 * -------
 * Standard result returned when attempting to open a protected PDF.
 *
 * This file contains NO PDFium logic.
 * This file contains NO UI logic.
 * =============================================================================
 */

import type { IProtectedPdfDocument }
    from "../interfaces/IProtectedPdfDocument";

import type { ProtectedPdfStatus }
    from "./ProtectedPdfStatus";

export interface ProtectedPdfOpenResult {

    /**
     * Controlled result status.
     */
    readonly status:
        ProtectedPdfStatus;

    /**
     * Opened protected document.
     *
     * Null when opening fails.
     */
    readonly document:
        IProtectedPdfDocument | null;

    /**
     * Number of pages in the opened document.
     *
     * Zero when the document was not opened.
     */
    readonly pageCount:
        number;

    /**
     * Human-readable diagnostic message.
     *
     * Null when there is no error.
     */
    readonly message:
        string | null;

}