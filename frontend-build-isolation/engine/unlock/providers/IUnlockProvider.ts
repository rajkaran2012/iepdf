/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : IUnlockProvider.ts
 * Module     : Unlock
 * Layer      : Provider Contract
 * =============================================================================
 */

import type { UnlockedPdfResult }
    from "../UnlockedPdfResult";

export interface IUnlockProvider {

    /**
     * Unlocks an encrypted PDF and returns the resulting PDF bytes together
     * with the actual encryption state of the source PDF.
     */
    unlock(
        file: File,
        password: string
    ): Promise<UnlockedPdfResult>;

}
