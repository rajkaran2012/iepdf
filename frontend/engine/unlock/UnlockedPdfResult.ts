/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : UnlockedPdfResult.ts
 * Module     : Unlock
 * Layer      : Model
 *
 * Purpose
 * -------
 * Represents the result of converting a protected PDF into browser PDF bytes.
 *
 * The encryption state describes the ORIGINAL source PDF.
 * =============================================================================
 */

export interface UnlockedPdfResult {

    /**
     * PDF bytes ready for the browser document layer.
     */
    readonly bytes: ArrayBuffer;

    /**
     * True when the ORIGINAL source PDF was encrypted.
     */
    readonly encrypted: boolean;

}
