/**
 * =============================================================================
 * iePDF Protected Document Engine
 * =============================================================================
 *
 * File       : ProtectedPdfStatus.ts
 * Module     : Protected Document
 * Layer      : Model
 *
 * Purpose
 * -------
 * Defines controlled application-level results for protected PDF opening.
 *
 * This file contains NO PDFium logic.
 * This file contains NO UI logic.
 * =============================================================================
 */

export enum ProtectedPdfStatus {

    /**
     * PDF opened successfully.
     */
    OPENED = "OPENED",

    /**
     * PDF requires a password and no password was supplied.
     */
    PASSWORD_REQUIRED = "PASSWORD_REQUIRED",

    /**
     * A password was supplied but PDFium rejected it.
     */
    INVALID_PASSWORD = "INVALID_PASSWORD",

    /**
     * PDF could not be opened for another reason.
     */
    OPEN_FAILED = "OPEN_FAILED",

}