/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : UnlockResult.ts
 * Module     : Unlock
 * Layer      : Model
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Standard result returned by PasswordVerifier and BrowserPdfUnlocker.
 * =============================================================================
 */

import type { BrowserPdfDocument } from "@/engine/pdf/BrowserPdfDocument";

export interface UnlockResult {

    /**
     * Unlock operation succeeded.
     */
    success: boolean;

    /**
     * Password was required.
     */
    passwordRequired: boolean;

    /**
     * Password was accepted.
     */
    passwordAccepted: boolean;

    /**
     * Unlocked BrowserPdfDocument.
     */
    document: BrowserPdfDocument | null;

    /**
     * Error message.
     */
    message: string | null;

}