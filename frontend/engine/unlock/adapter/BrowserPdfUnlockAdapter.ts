/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : BrowserPdfUnlockAdapter.ts
 * Module     : Unlock
 * Layer      : Adapter
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Converts a successfully verified encrypted PDF into bytes that can be
 * consumed by the document processing pipeline.
 *
 * This class contains NO UI logic.
 * This class contains NO merge logic.
 * =============================================================================
 */

export class BrowserPdfUnlockAdapter {

    /**
     * Creates unlocked PDF bytes.
     *
     * Stage 1
     * -------
     * Currently returns the original bytes.
     *
     * Stage 2
     * -------
     * This method will later integrate the selected browser PDF
     * implementation capable of producing unlocked bytes.
     */
    public async createUnlockedBytes(
        file: File
    ): Promise<ArrayBuffer> {

        return await file.arrayBuffer();

    }

}