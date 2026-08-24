/**
 * =============================================================================
 * iePDF Protected Document Engine
 * =============================================================================
 *
 * File       : ProtectedPdfAuthorization.ts
 * Module     : Protected Document
 * Layer      : Model
 *
 * Purpose
 * -------
 * Represents the application-level authorization state of an opened
 * protected PDF.
 *
 * This model contains NO PDFium logic.
 * This model contains NO raw PDFium permission flags.
 * This model contains NO UI logic.
 * =============================================================================
 */

export interface ProtectedPdfAuthorization {

    /**
     * Whether the opened PDF is encrypted.
     */
    readonly encrypted: boolean;

    /**
     * Whether owner-level authorization is currently available.
     */
    readonly ownerUnlocked: boolean;

    /**
     * Whether this document is authorized for the encryption-removal
     * bridge used by iePDF.
     */
    readonly encryptionRemovalAllowed: boolean;

}
