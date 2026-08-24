/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : BrowserPdfUnlockAdapter.ts
 * Module     : Unlock
 * Layer      : Adapter
 *
 * Purpose
 * -------
 * Converts a password-protected PDF into browser PDF bytes through the
 * configured unlock provider.
 * =============================================================================
 */

import type { IUnlockProvider }
    from "../providers/IUnlockProvider";

import type { UnlockedPdfResult }
    from "../UnlockedPdfResult";

export class BrowserPdfUnlockAdapter {

    public constructor(
        private readonly unlockProvider:
            IUnlockProvider
    ) {
    }

    /**
     * Creates browser-ready PDF bytes and preserves the actual source
     * encryption state.
     */
    public async createUnlockedBytes(
        file: File,
        password: string
    ): Promise<UnlockedPdfResult> {

        return await this.unlockProvider.unlock(
            file,
            password
        );

    }

}
