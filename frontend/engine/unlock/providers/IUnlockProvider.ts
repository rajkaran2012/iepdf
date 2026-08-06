/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : IUnlockProvider.ts
 * Module     : Unlock
 * Layer      : Provider Contract
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the contract for browser unlock providers.
 *
 * Different implementations can later support:
 *
 * • Commercial SDK
 * • Enterprise SDK
 * • Future Open Source implementation
 *
 * BrowserPdfUnlockAdapter depends ONLY on this interface.
 * =============================================================================
 */

export interface IUnlockProvider {

    /**
     * Unlocks an encrypted PDF.
     *
     * Returns unlocked PDF bytes.
     */
    unlock(
        file: File,
        password: string
    ): Promise<ArrayBuffer>;

}